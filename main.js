window.requestAnimFrame=function(){return window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.oRequestAnimationFrame||window.msRequestAnimationFrame||function(a){window.setTimeout(a,1E3/60)}}();

const bgColor = '#222222';

let canvas = document.getElementById('canvas');
let context = canvas.getContext('2d');

let dpr = window.devicePixelRatio;
var cw = window.innerWidth - 10;
var ch = window.innerHeight - 10;
canvas.width = cw * dpr;
canvas.height = ch * dpr;

context.scale(dpr, dpr);
canvas.addEventListener('mousedown', onSelect, false);
canvas.addEventListener('dblclick', onDoubleClick, false);

let selectedProductId = null;
let hStep = 300;
let vStep = 100;

addEventListener("resize", onResize, false);

let colors = [];
loadColors('./colors.json')
.then(response => colors = response);

let locale = "en";
let l18n = [];
let needRedraw = false;
loadL18n(locale).then(response => {
	l18n = response;
 });

let productsToRender = [];
let allProducts = [];
loadProductsMap('./maps/common.json')
.then(response => { 
	allProducts = response;
	if(allProducts && allProducts.length > 0)
	{
		showProduct(allProducts[0].id);
		updateProductList();
	}
});

function loadColors()
{
	return fetch("./colors.json")
	.then((response) => response.json())
    .then((data) =>{return data.colors})
	.catch(error => console.warn(error));
}

function updateProductList()
{
	let productListComponent = document.getElementById('products_list');

	let innerHtml ="";
	allProducts.forEach(product=>{
		innerHtml = innerHtml +"<li><a href=\"#\" class=\"list-group-item list-group-item-action\" onclick=\"showProduct('"+product.id+"')\">"+getLocale(product.id)+"</a></li>" + "\n";
	});

	productListComponent.innerHTML = innerHtml;
}

function showProduct(productId)
{
	selectedProductId = productId;
	productsToRender = [];
	let toShow = getProductsToShow(productId, allProducts);
	let byTier = mapProductsByTier(toShow);
	let aligned = alignProductPositions(byTier);
		productsToRender = flattenProducts(aligned);
		colorizeProducts(productsToRender);
		needRedraw = true;

		updateProductInfo(productId);
}

function colorizeProducts(products)
{
	for(let i=0; i<products.length; i++)
	{
		if(i>colors.length)
		{
			products[i].color = "#ffffff";
		}
		else
		{
			products[i].color = colors[i];
		}
	}
}


function toggleLocale()
{
	locale = locale == "en" ? "ru" : "en";
	loadL18n(locale).then(response => {
		l18n = response;
		updateProductList();
		showProduct(selectedProductId)
	 });
}

function updateProductInfo(productId)
{
	let dropdownBtn = document.getElementById('dropdown_btn');
	let product = allProducts.find(c=>c.id == productId);
	if(product) 
	{
		dropdownBtn.innerText = getLocale(product.id)
	}



}

function getProductsToShow(productId, products)
{
	let result = [];
	let product = products.find(c=>c.id == productId);
	if(product) 
	{
		result.push(product);
		if(product.precursors)
		{
			product.precursors?.forEach(p=>{
				let precursors = getProductsToShow(p.id, products);

				precursors.forEach(p=>{
					if(!result.find(c=>c.id == p.id))
					{
						result = [p, ...result];
					}
				})
			});
		}
	}

	return result;
}

function mapProductsByTier(products)
{
	let productsByTier = [];	
	products.forEach(product=>{
		if(!productsByTier[product.tier]) productsByTier[product.tier] = [];
		productsByTier[product.tier].push(product);
		 });
	return productsByTier;
}
	
function loadL18n(locale)
{
  return fetch("./l18n/"+locale+".json")
	.then((response) => response.json())
    .then((data) =>{return data.localization})
	.catch(error => console.warn(error));
}

function getLocale(id)
{
	let result = l18n.find(c=>c.id == id);
	return result?.value ?? id;
}

function loadProductsMap(src)
{
  return fetch(src)  
	.then((response) => response.json())
    .then((data) =>{return data.products})
	.catch(error => console.warn(error));
}

function alignProductPositions(products)
{
	let dx = (canvas.width /2) - (hStep * products.length) / 2

	for (let tier = 0; tier < products.length; tier++)
	{
		let innerArrayLength = products[tier].length;
		let dy = (canvas.height / 2) - (vStep * innerArrayLength) / 2;

		for (let productIndex = 0; productIndex < innerArrayLength; productIndex++) {
			let x = hStep * tier + dx+200;
			let y = vStep * productIndex + dy;
			products[tier][productIndex].input = {x, y};
			products[tier][productIndex].output = {x:x+220, y};
		}
	}
	return products;
}

function flattenProducts(products)
{
	let flattenProducts=[];
	for (let tier = 0; tier < products.length; tier++)
	{
		let innerArrayLength = products[tier].length;
		for (let productIndex = 0; productIndex < innerArrayLength; productIndex++) {
			flattenProducts.push(products[tier][productIndex])
		}
	}
	return flattenProducts;
}

function drawProducts(products) {	
	
	products.forEach(product => drawProduct(product));

}

function setSelection(products) {	
	products.forEach(product => {
		if(product.selected && product.tier > 0)
		{
			product.precursors.forEach(prec=>{
				let precursor = products.find(p=>p.id == prec.id);
				if(precursor)
				{
					precursor.selected = true;
				}
			})
		}
	});
}

function drawConnections(products) {	
	products.forEach(product => {
		if(product.tier > 0)
		{
			product.precursors.forEach(prec=>{
				let precursor = products.find(p=>p.id == prec.id);
				if(precursor)
				{
					drawConnection(precursor, product)
				}
			})
		}
	});
}

function drawConnection(src, tgt) {	
	let p0 = src.output;
	let p1 = tgt.input;

	context.beginPath();
	context.setLineDash([3, 3]);
	context.lineWidth = tgt.selected ? 2 : 0.5;
	context.strokeStyle = tgt.selected ? src.color : '#444444';
	context.moveTo(p0.x, p0.y);

	let pm = {x:p0.x, y:p0.y};

	let dTier = tgt.tier - src.tier;
	if(dTier > 1)
	{
		pm.x = p0.x + hStep * (dTier - 1);
		context.lineTo(pm.x, pm.y);
	}



	context.bezierCurveTo(p1.x, pm.y, pm.x, p1.y, p1.x, p1.y);
	context.stroke();
}

function drawProduct(product) {	
	let x = product.input.x;
	let y = product.input.y;
	
	context.beginPath();
	context.setLineDash([]);
	context.moveTo(x, y);
	context.lineTo(x+20, y-20);
	context.lineTo(x+200, y-20);
	context.lineTo(x+220, y);
	context.lineTo(x+200, y+20);
	context.lineTo(x+20, y+20);
	context.closePath();

    context.fillStyle = product.selected ? product.color : bgColor;
	context.fill();
	

	context.lineWidth = 1;
	// set line color
	context.strokeStyle = product.color;
	context.stroke();

	context.textBaseline = "center";
	context.fillStyle = product.selected ? invertColor(product.color, true) : "#ffffff";
	context.font = "16px arial";
	context.fillText(getLocale(product.id), x+20, y+5);

	if(product.selected)
	{
	if(product.cycleProduction)
	{
	context.fillStyle = product.color;
	context.font = "10px arial";
	context.fillText(product.cycleProduction, x+215, y-10);
	}

	if(product.precursors)
	{
		let hshift = 0;
		product.precursors.forEach(prc=>{
			let precursor = productsToRender.find(c=>c.id == prc.id);
			if(precursor)
			{
				context.fillStyle = precursor.color;
				context.font = "10px arial";
				context.fillText(prc.cycleConsumption, x+20 + hshift , y-25);
				hshift +=20;
			}
		});

	}
}

}

function onDoubleClick(e)
{
	var point = {x: e.pageX - canvas.offsetLeft, y: e.pageY - canvas.offsetTop};		
	productsToRender.forEach(product=>{
		if(productClicked(point, product))
		{
			showProduct(product.id);
		}
	});
}

function onSelect(e){
	var point = {x: e.pageX - canvas.offsetLeft, y: e.pageY - canvas.offsetTop};		
	productsToRender.forEach(product=>{
	
	if(productClicked(point, product))
		{
			selectProduct(product);
		}
		else
		{
			product.selected = false;
		}
	
	});
	setSelection(productsToRender);
}

function selectProduct(product)
{
	product.selected = true;
	if(product.tier == 0 || !product.precursors) return;

	product.precursors.forEach(prec=>{
		let precursor = productsToRender.find(p=>p.id == prec.id);
		if(precursor)
		{
			selectProduct(precursor);
		}
	})

}


function productClicked(point, product)
{
	needRedraw = true;
	return point.x > product.input.x 
		&& point.x < product.output.x
		&& point.y > product.input.y - 20
		&& point.y < product.output.y + 20;
}

function onResize(e)
{
	let dpr = window.devicePixelRatio;
	var cw = window.innerWidth - 10;
	var ch = window.innerHeight - 10;
	canvas.width = cw * dpr;
	canvas.height = ch * dpr;
	showProduct(selectedProductId)

}

function fillCanvas(color)
{
	context.fillStyle = color;
	context.fillRect(0,0,cw,ch);

}

function invertColor(hex, bw) {
    if (hex.indexOf('#') === 0) {
        hex = hex.slice(1);
    }
    // convert 3-digit hex to 6-digits.
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) {
        throw new Error('Invalid HEX color.');
    }
    var r = parseInt(hex.slice(0, 2), 16),
        g = parseInt(hex.slice(2, 4), 16),
        b = parseInt(hex.slice(4, 6), 16);
    if (bw) {
        // https://stackoverflow.com/a/3943023/112731
        return (r * 0.299 + g * 0.587 + b * 0.114) > 186
            ? '#000000'
            : '#FFFFFF';
    }
    // invert color components
    r = (255 - r).toString(16);
    g = (255 - g).toString(16);
    b = (255 - b).toString(16);
    // pad each with zeros and return
    return "#" + padZero(r) + padZero(g) + padZero(b);
}

var loop = function()
{
	window.requestAnimFrame(loop);
	if(needRedraw == true)
	{
		fillCanvas(bgColor);
		drawConnections(productsToRender);
		drawProducts(productsToRender);
		needRedraw = false;
	}
}
            
loop();
