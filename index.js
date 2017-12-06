// Master
const cluster = require('cluster')

if(cluster.isMaster) {

	// Count the machine's CPUs and fork the process
	require('os')
		.cpus()
		.forEach(() => cluster.fork())
	
} else {
	// Libraries
	const express = require('express')
	const fs = require('fs')
	const app = express()
	const request = require('request')
	const jimp = require('jimp')
	const compression = require('compression')
	const fileUpload = require('express-fileupload') //https://www.npmjs.com/package/express-fileupload
	const Image = require('./image')
	const utils = require('./utils')

	app.use(compression())
	app.use(express.static('public'))
	app.use(fileUpload())

	// Global variables
	const PORT = process.env.PORT || 3000
	const MAX_HEIGHT = 1600
	const MAX_WIDTH = MAX_HEIGHT

	utils.init()

	/**
	 * @param GET an image with specified height, width and category
	 * Example request: https://www.....com/?width=300&height=200&category=messi
	 */ 
	app.get('/images/', (request, response) => {
		// Getting from URI params
		const category = request.query.category.toLowerCase()
		const width = Math.min(request.query.width, 1600)
		const height = Math.min(request.query.height, 1600)

		if(width > 1600 || height > 1600) response.status(401).send('')

		// Getting the path of the image
		const image = utils.getImage(width, height, category)
			.then(path => {
				const splitted = path.split('/')
				const filename = splitted.splice(splitted.length - 1, 1)
				const base = splitted.join('/')
				response.sendFile(filename, {
					root: base
				})
			}).catch(err => response.status(500).send(err))
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
					response.status(401).send('El tamaño de la imagen es menor que 1600x1600')
					fs.unlink(path, err => { if(err) throw err })
				} else {
					// It renames the image
					response.send('Archivo subido exitosamente!')
					img.path = `${category}/original/${img.width}x${img.height}-${index}.${extension}`
					fs.rename(path, `${__dirname}/${utils.CATEGORIES_FOLDER}/${img.path}`, (err) => {
						if(err) console.err(err)
					})
					utils.insertOriginal(img, category)
				}
			}).catch(console.err)
		})
	})

	/**
	 * @param GET all categories
	 */
	app.get('/categories', (request, response) => {
		const keys = Object.keys(utils.originals)
		const categories = (keys.length !== 0)? keys : fs.readdirSync(`${utils.CATEGORIES_FOLDER}`)
		response.send(categories)
	})

	/**
	 * @param POST new category
	 */
	app.post('/categories', (request, response) => {
		if(request.query.category.trim() === '') response.status(401).send('La categoría no puede estar vacía')
		const category = request.query.category.toLowerCase()
		const dir = `${utils.CATEGORIES_FOLDER}/${category}`
		if (!utils.categoryExists(category)){
			response.status(200).send()
			fs.mkdirSync(dir)
			fs.mkdirSync(`${dir}/original`)
			utils.addCategory(category)
		} else response.status(401).send('La categoría ya existe')
	})

	console.log(`Listening in port ${PORT}`)
	app.listen(PORT)
	console.log(`Worker ${cluster.worker.id} ready`)
}


/**
 * Listens for processes that exit in order to create new ones
 */
cluster.on('exit', (worker) => {
	console.log(`Worker ${worker.id} died, reinitializing the process`)
	cluster.fork()
})