# Imcache.js

### Imcache is a Node JS Application used to upload images for mocking up websites

You can choose a category with an image size, or just ask for any image with that size. The first time you query for an image will take about 1 second to crop the image. The next time, it will serve it from the file system.

## Installation

In order to install it, just follow the instructions below: 

```
// Clones the repository into your local machine
git clone https://github.com/tomaspiaggio/imcache.git ImcacheJS

// Change directory into the cloned repo
cd ImcacheJS

// Installs dependencies
npm install
```

## Usage

#### Upload

In order to upload the image, go to localhost:3000, and there is a simple UI that lets you do just that. It also allows you to flush (which means to clear all the generated images) or flush all the categories.

Images must be more than 1600x1600 pixels. 

#### Queries

Querying is as simple as making a get to `http://localhost:3000/images/{width}x{height}/category/{category}`. The category is optional, and also is sending both the width and the height. You could just send one and it will return a squared image with that size.

Examples: 

```
http://localhost:3000/images/300x300/category/messi

http://localhost:3000/images/500

http://localhost:3000/images/1000x1000/category/soccer
```

## Suggestions

- It is a good idea to use JPEG images over PNG as the cropping library is not able to lower the quality of PNG as good. This will improve transfer speeds.
- It is better to always specify the category. If you don't, the server will probably pick a different category every time, which will take more to load each image (because it has to crop a different image for every category).

## TO DO

- GZIP not working
- Improve cropping speed (maybe another library)
- Improve UI
