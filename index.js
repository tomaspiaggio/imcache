// Master
const cluster = require('cluster')

if(cluster.isMaster) {

	const workers = []

	// Count the machine's CPUs and fork the process
	require('os')
		.cpus()
		.forEach(() => workers.push(cluster.fork()))

	workers.forEach(w => w.on('message', (message) => {
		workers.forEach(worker => {
			if(worker.id != w.id) worker.send(message)
		})
	}))
	
} else {
	// DEPENDENCIES
	const express = require('express')
	const fs = require('fs')
	const app = express()
	const request = require('request')
	const jimp = require('jimp')
	const compression = require('compression')
	const fileUpload = require('express-fileupload') //https://www.npmjs.com/package/express-fileupload
	const Image = require('./image')
	const utils = require('./utils')
	const processActions = []

	// EXPRESS CONFIG AND MIDDLEWARE
	app.use(compression())
	app.use(express.static('public'))
	app.use(fileUpload())

	
	// GLOBAL CONSTANTS
	const PORT = process.env.PORT || 3000
	const MAX_HEIGHT = 1600
	const MAX_WIDTH = MAX_HEIGHT

	
	// CLUSTER MANAGEMENT

	/**
	 * Initializes the processAction function list and the utils
	 */
	function init(){
		processActions['category-update'] = (category) => utils.addCategory(category)
		processActions['new-original'] = (original) => utils.insertOriginal(original.img, original.category)
		processActions['new-cropped'] = (cropped) => utils.insertPicture(cropped.result, cropped.category, utils.categories)
		processActions['flush-category'] = (category) => utils.flushCategory(category)
		utils.init()
	}
	init()

	/**
	 * It sends an update to all other workers in the cluster in order to perform some action
	 * @param {key, value} message is a key, value object that is sent to every other worker
	 */
	function updateOtherWorkers(message) {
		process.send(message)
	}

	/**
	 * Expects a message from the master process (observable pattern)
	 * @param message a key, value object. The key is used to get a function, and the value is passed to the function to do different actions
	 * with different keys. Look init()
	 */
	process.on('message', (message) => {
		processActions[message.key](message.value)
	})


	// EXPRESS

	/**
	 * @param DELETE deletes all the generated files within a category
	 * If DELETEALL is sent instead, then all the categories are cleared
	 */
	app.delete('/category', (request, response) => {
		const rawCategory = request.query.category
		if(rawCategory == 'DELETEALL'){
			const keys = Object.keys(utils.originals)
			Promise.all(keys.map((category) => deleteCategory(category)))
				.then(() => response.send('ok'))
				.catch((err) => response.status(500).send(err))
		} else {
			const category = rawCategory.toLowerCase()
			if(!category) response.status(400).send()
			deleteCategory(category)
				.then(() => response.send('ok'))
				.catch((err) => response.status(500).send(err))
		}
	})

	function deleteCategory(category) {
		return new Promise((resolve, reject) => {
			utils.flushCategory(category)
			updateOtherWorkers({key: 'flush-category', value: category})
			const path = `${utils.CATEGORIES_FOLDER}/${category}`
			fs.readdir(path, (error, files) => {
				if(error) reject('Error reading files from file system')
				files.filter(e => e !== 'original').forEach(e => {
					fs.unlink(`${path}/${e}`, (error) => {
						if(error) reject('There was an error deleting one of the files')
					})
				})
				resolve()
			})
		})
	}

	/**
	 * @param GET an image with specified height, width and category
	 * Example request: https://www.....com/?width=300&height=200&category=messi
	 */ 
	app.get('/images/:size', (request, response) => {
		// Getting from URI params
		const size = request.params.size
		const category = utils.randomCategory()
		let width, height
		if(size.indexOf('x') > 0) {
			width = size.substring(0, size.indexOf('x'))
			height = size.substring(size.indexOf('x') + 1, size.length)
		} else {
			width = size
			height = size
		}

		width = Math.min(Math.max(width, 25), 1600)
		height = Math.min(Math.max(height, 25), 1600)

		if(width > 1600 || height > 1600) response.status(400).send('')

		// Getting the path of the image
		getImage(width, height, category, response)
	}, err => console.err(err))

	/**
	 * @param GET an image with specified height, width and category
	 * Example request: https://www.....com/?width=300&height=200&category=messi
	 */ 
	app.get('/images/:size/category/:category', (request, response) => {
		// Getting from URI params
		const size = request.params.size
		const category = request.params.category
		let width, height
		if(size.indexOf('x') > 0) {
			width = size.substring(0, size.indexOf('x'))
			height = size.substring(size.indexOf('x') + 1, size.length)
		} else {
			width = size
			height = size
		}

		width = Math.min(Math.max(width, 25), 1600)
		height = Math.min(Math.max(height, 25), 1600)

		if(width > 1600 || height > 1600) response.status(400).send('')

		// Getting the path of the image
		getImage(width, height, category, response)
	}, err => console.err(err))

	/**
	 * @param POST The upload image path
	 */
	app.post('/upload', (request, response) => {
		if (!request.files) return response.status(400).send('No se subió ningun archivo')

		// The name of the input field (i.e. "image") is used to retrieve the uploaded file
		const image = request.files.image
		const category = request.query.category.toLowerCase()
		const original = utils.findCategory(category)
		if(!original) {
			response.status(404).send('Categoría no encontrada')
			return
		}
		const index = utils.max(original.map(e => parseInt(e.path.substring(e.path.indexOf('-') + 1, e.path.indexOf('.'))))) + 1
		const splittedFile = image.name.split('.')
		const extension = splittedFile[splittedFile.length - 1]

		// This is a temporal name for the image to check the size
		const path = `${__dirname}/${utils.CATEGORIES_FOLDER}/${category}/original/${index}.${extension}`
		
		// Saves the image with the name above and checks the name, then it adds the width and height
		image.mv(path, (err) => {
			if (err) return response.status(500).send(err)
		
			// The image size check, returns an image object
			utils.imgSize(path).then(img => {
				// Images with width or height lesss than 1600 are not supported
				if(img.width < 1600 || img.height < 1600) {
					response.status(400).send('El tamaño de la imagen es menor que 1600x1600')
					fs.unlink(path, err => { if(err) throw err })
				} else {
					// It renames the image
					response.send('Archivo subido exitosamente!')
					img.path = `${category}/original/${img.width}x${img.height}-${index}.${extension}`
					fs.rename(path, `${__dirname}/${utils.CATEGORIES_FOLDER}/${img.path}`, (err) => {
						if(err) console.err(err)
					})
					utils.insertOriginal(img, category)
					updateOtherWorkers({key: 'new-original', value: {img: img, category: category}})
				}
			}).catch(console.err)
		})
	})

	/**
	 * @param GET all categories
	 */
	app.get('/categories', (request, response) => {
		response.send(Object.keys(utils.originals))
	})

	/**
	 * @param POST new category
	 */
	app.post('/categories', (request, response) => {
		if(request.query.category.trim() === '') response.status(400).send('La categoría no puede estar vacía')
		const category = request.query.category.toLowerCase()
		const dir = `${utils.CATEGORIES_FOLDER}/${category}`
		if (!utils.categoryExists(category)){
			response.status(200).send()
			fs.mkdirSync(dir)
			fs.mkdirSync(`${dir}/original`)
			utils.addCategory(category)
			updateOtherWorkers({key: 'category-update', value: category})
		} else response.status(400).send('La categoría ya existe')
	})

	/**
	 * Separated from function as there are very similar end points that use it
	 * @param {number} width the width of the wanted image
	 * @param {number} height the height of the wanted image
	 * @param {string} category the name of the category
	 * @param {Response} response the Express Response object
	 */
	function getImage(width, height, category, response) {
		const image = utils.getImage(width, height, category)
			.then(result => {
				const splitted = result.path.split('/')
				const filename = splitted.splice(splitted.length - 1, 1)
				const base = splitted.join('/')
				if(result.created) updateOtherWorkers({key: 'new-cropped', value: {result: result.created, category: result.category}})
				response.sendFile(filename, {
					root: base
				})
			}).catch(err => response.status(500).send(err))
	}

	console.log(`Listening in port ${PORT}`)
	app.listen(PORT)
	console.log(`Worker ${cluster.worker.id} ready`)
}


/**
 * Listens for processes that exit in order to create new ones
 */
cluster.on('exit', (worker) => {
	worker.kill('SIGKILL')
	console.log(`Worker ${worker.id} died, reinitializing the process`)
	cluster.fork()
})