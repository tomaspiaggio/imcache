const fs = require('fs')
const jimp = require('jimp')
const CATEGORIES_FOLDER = 'categories'
const Image = require('./image')
const categories = []
const originals = []
/**
 * Load categories into memory
 */
function init() {
    if (!fs.existsSync(CATEGORIES_FOLDER)){
        fs.mkdirSync(dir)
    const auxCategories = []
    fs.readdir(CATEGORIES_FOLDER, (err, files) => {
        files = files.filter(e => e.indexOf('.DS_Store') < 0)
        files.forEach(e => fillCategories(`${e}/original`, e, originals))
        files.forEach(cat => fillCategories(cat, cat, categories))
    })
}

/**
 * Loads all the images from a category
 * @param category: the name of the category being loaded
 */
function fillCategories(path, category, list) {
    const folder = `${CATEGORIES_FOLDER}/${path}`
    fs.readdir(folder, (err, files) => {
        insertIntoList(files.filter(e => e !== 'original').map(e => {
            const image = new Image()
            const size = imageSize(e)
            image.path = `${path}/${e}`
            image.width = size.width
            image.height = size.height
            return image
        }), category, list)
    })
}

/**
 * Decoupling filling implementation for future tree implementation
 * @param elements: elements to be inserted into a category
 * @param category: the category that will have the new elements
 */
function insertIntoList(elements, category, list) {
    list[category] = elements
}

/**
 * Inserts one picture into a category (decoupling implementation for future data structure changes)
 * @param element the element that wants to be inserted
 * @param category the category into which the element will be inserted
 * @param list the actual list where the image will live
 */
function insertPicture(element, category, list) {
   list[category].push(element)
}

/**
 * Inserts an image into the original data structure
 * @param element the element that wants to be inserted
 * @param category the category into which the element will be inserted
 */
function insertOriginal(element, category) {
    insertPicture(element, category, originals)
}

/**
 * Decoupling implementation for future data structure changes
 * @param category: the category you want to find
 */
function findCategory(category) {
    return originals[category]
}

/**
 * Finds an image size inside a category
 * @param image 
 * @param category 
 */
function findImage(width, height, category) {
    const cat = categories[category]
    if(!cat) return null
    return cat.find(e => { if(e.width == width && e.height == height) return e })
}

/**
 * Creates a new category in memory
 * @param category the new category
 */
function addCategory(category) {
    categories[category] = []
    originals[category] = []
}

/**
 * Returns a promise of the image's width and height
 * @param path: the path to the image
 */
function imageSize(path) {
    const index = path.indexOf('x')
    return {
        width: path.substring(0, index),
        height: path.substring(index + 1, path.indexOf('-'))
    }
}

/**
 * Saves an image to the file system
 * @param image the actual image object that wants to be saved
 * @param category the category in which you want to save the file
 */
function saveImage(image, category, imageData) {
    fs.writeFile(`${CATEGORIES_FOLDER}/${category}/${image.path}`, imageData, (err) => { if(err) throw err })
}

function saveOriginalImage(image, category, imageData) {
    saveImage(image, `${category}/original`)
}

/**
 * Finds the mamimum value in a list
 * @param list: the list where you want to find the maximum
 */ 
function max(list) {
    if(!list || list.length == 0) return 0
    let aux = list[0]
    for(var i = 1; i < list.length; i++) {
        if(list[i] > aux) aux = list[i]
    }
    return aux
}

/**
 * Returns the image size in an Image object
 * @param path the path of the image you want the size of
 */
function imgSize(path) {
    return new Promise((resolve, reject) => {
        const image = new jimp(path, (err, image) => {
            if(err) reject(err)
            const w = image.bitmap.width; // the width of the image
            const h = image.bitmap.height; // the height of the image
            resolve(new Image('', w, h))
        });
    })
}

function randomImage(category) {
    const cat = originals[category]
    if(cat) return cat[parseInt(Math.random() * cat.length)]
}

/**
 * Gets image from file system. First looking up the suitable ones in mongodb
 * @param width: the path to the image
 * @param height: the path to the image
 * @param category: the path to the image
 */
function getImage(width, height, category) {
    return new Promise((resolve, reject) => {
        const path = `${CATEGORIES_FOLDER}/${category}`
        width = parseInt(width)
        height = parseInt(height)

        // Checks if the image is already created, if it is, it gets the image and returns it
        const result = findImage(width, height, category)
        if(result) resolve(`${CATEGORIES_FOLDER}/${result.path}`)
        else {
            const file = randomImage(category)
            insertPicture(new Image(`${category}/${width}x${height}-${file.path.split('-')[1]}`, width, height), category, categories)
            jimp.read(`${CATEGORIES_FOLDER}/${file.path}`, (err, image) => {
                if(err) reject(err)
                const croppedPath = `${path}/${width}x${height}-${file.path.split('-')[1]}`
                const originalWidth = image.bitmap.width
                const originalHeight = image.bitmap.height
                if(width > height) {
                    const x = originalWidth / width
                    const newHeight = originalHeight/x
                    image.resize(width, newHeight)
                        .crop(0, (newHeight - height)/2, width, height)
                        .write(croppedPath, () => resolve(croppedPath))
                } else {
                    const x = originalHeight / height
                    const newWidth = originalWidth/x
                    image.resize(newWidth, height)
                        .crop((newWidth - width)/2, 0, width, height)
                        .write(croppedPath, () => resolve(croppedPath))
                }
            })
        }
    })
}

module.exports = {
    init: init,
    fillCategories: fillCategories,
    insertPicture: insertPicture,
    addCategory: addCategory,
    imgSize: imgSize,
    saveImage: saveImage,
    saveOriginalImage: saveOriginalImage,
    max: max,
    imageSize: imageSize,
    CATEGORIES_FOLDER: CATEGORIES_FOLDER,
    categories: categories,
    findImage: findImage,
    getImage: getImage,
    originals: originals,
    findCategory: findCategory,
    insertOriginal: insertOriginal
}