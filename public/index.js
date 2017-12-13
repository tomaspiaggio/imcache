(function(window){
    const select = document.querySelector('select')
    const upload = document.querySelector('.upload')
    const form = document.querySelector('form')
    const categoryContainer = document.querySelector('.new--category')
    const categoryInput = categoryContainer.querySelector('input')
    const categoryButton = categoryContainer.querySelector('.category')
    const flushCategoryButton = document.querySelector('.flush')
    const disabled = [upload, flushCategoryButton]
    
    get('/categories').then(e => {
        addOption(select, 'ninguna')
        JSON.parse(e.response).forEach(opt => addOption(select, opt))
    }).catch(console.error)

    select.addEventListener('change', (event) => {
        disabled.forEach(e => e.disabled = select.value === 'ninguna')
        form.action = `/upload?category=${select.value}`
    })

    categoryButton.addEventListener('click', () => {
        const category = categoryInput.value
        if(category.trim() !== '') post(`/categories?category=${category}`)
            .then(() => {
                categoryInput.value = ''
                console.log(`Categoría: ${category} creada`)
            }).catch(console.error)
    })

    flushCategoryButton.addEventListener('click', () => {
        del(`category?category=${select.value}`)
            .then(e => console.log(e.response))
            .catch(console.err)
    })

    function get(path) {
        return new Promise((resolve, reject) => {
            const xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
                if(this.readyState == 4){
                    if (this.status == 200) resolve(this)
                    else if(this.status > 400) reject(this)
                }
            };
            xhttp.open("GET", path, true);
            xhttp.send();
        })
    }

    function post(path) {
        return new Promise((resolve, reject) => {
            const xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
                if(this.readyState == 4){
                    if (this.status == 200) resolve(this)
                    else if(this.status > 400) reject(this)
                }
            };
            xhttp.open("POST", path, true);
            xhttp.send();
        })
    }

    function del(path) {
        return new Promise((resolve, reject) => {
            const xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
                if(this.readyState == 4){
                    if (this.status == 200) resolve(this)
                    else if(this.status > 400) reject(this)
                }
            };
            xhttp.open("DELETE", path, true);
            xhttp.send();
        })
    }

    function addOption(select, option) {
        const opt = document.createElement('OPTION')
        opt.value = option
        opt.textContent = option.split(' ').map(e => e.substring(0, 1).toUpperCase() + e.substring(1)).join('')
        select.appendChild(opt)
    }
})(window);