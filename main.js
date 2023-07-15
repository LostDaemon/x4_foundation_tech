window.requestAnimFrame=function(){return window.requestAnimationFrame||window.webkitRequestAnimationFrame||window.mozRequestAnimationFrame||window.oRequestAnimationFrame||window.msRequestAnimationFrame||function(a){window.setTimeout(a,1E3/60)}}();

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const urlProduct = urlParams.get('product')
const baseUrl = location.protocol + '//' + location.host + location.pathname;
const bgColor = '#222222';

let canvas = document.getElementById('canvas');
let context = canvas.getContext('2d');
let needRedraw = false;
let canvasContainer = document.getElementById('canvas_container'); 
const dpr = window.devicePixelRatio;

canvas.width  = canvas.offsetWidth;
canvas.height = canvas.offsetHeight;
context.scale(1, 1);

canvas.addEventListener('mousedown', onSelect, false);
canvas.addEventListener('dblclick', onDoubleClick, false);
addEventListener("resize", onResize);

let hStep = 300;
let vStep = 100;

const blockWidth = 200;
const blockSlope = 20;

let colors = [];
loadColors('./colors.json')
.then(response => colors = response);

let locale = "en";
let l18n = [];
let uil18n = [];

let productsToRender = [];
let allProducts = [];
let selectedProductId = null;

loadProductsL18n(locale)
.then(response => {
	l18n = response;
	loadUIL18n(locale)
	.then(response => {
		uil18n = response;

 	loadProductsMap('./maps/common.json')
	.then(response => { 
	allProducts = response;
	if(allProducts && allProducts.length > 0)
	{
		showProduct(urlProduct ?? allProducts[0].id);
		updateProductList(null);
	}
	});
   });
});

function loadColors()
{
	return fetch("./colors.json")
	.then((response) => response.json())
    .then((data) => data.colors)
	.catch(error => console.warn(error));
}

function onFilter()
{
	let filterInput = document.getElementById('filter');
	let filter = filterInput.value;
	updateProductList(filter);
}

function updateProductList(filter)
{
	let productListComponent = document.getElementById('products_list');
	let innerHtml ="";
    let filtered = filter ? 
	l18n.filter(c=>c.value.toUpperCase().includes(filter.toUpperCase())) 
	: l18n;

	filtered = filtered.sort((a,b) => (a.value > b.value) ? 1 : ((b.value > a.value) ? -1 : 0))
	filtered.forEach(c=>{
		innerHtml = innerHtml +"<li><a href=\"#\" class=\"list-group-item list-group-item-action\" onclick=\"showProduct('"+c.id+"')\">"+c.value+"</a></li>" + "\n";
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
		updateUrl(productId);
		updateProductInfo(productId);
		centerCanvasScroll();
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
	loadProductsL18n(locale).then(response => {
		l18n = response;
		loadUIL18n(locale).then(response => {
			uil18n = response;
		updateProductList();
		showProduct(selectedProductId)
		});
	 });
}

function updateProductInfo(productId)
{
	const dropdownBtn = document.getElementById('dropdown_btn');
	const product_label = document.getElementById('product_label');
	const consumption_label = document.getElementById('consumption_label');
	const production_label = document.getElementById('production_label');
	const is_used_for_label = document.getElementById('is_used_for_label');
	const consumption_list = document.getElementById('consumption_list');
	const production_list = document.getElementById('production_list');
	const ancestors_list = document.getElementById('ancestors_list');
	let product = allProducts.find(c=>c.id == productId);
	if(!product) return;

		dropdownBtn.innerText = getLocale(product.id)
		product_label.innerText = getLocale(product.id);
		consumption_label.innerText = getUiLocale("consumption_label");
		production_label.innerText = getUiLocale("production_label");
		is_used_for_label.innerText = getUiLocale("is_used_for_label");

		let consumptionInnerHtml = "";
		let cyclesPerHour = product.cycleDuration ? 3600/product.cycleDuration : 0;
		if(product.precursors)
		{
		product.precursors.forEach(p=>{
			consumptionInnerHtml = consumptionInnerHtml +"<li><b>"+getLocale(p.id)+"</b>: <font style='color:yellow'>"+ p.cycleConsumption +"</font> "+getUiLocale("per_cycle")+" (<font style='color:yellow'>"+p.cycleConsumption*cyclesPerHour+"</font> "+getUiLocale("per_hour")+")</li>" + "\n";
		});
		consumption_list.innerHTML = consumptionInnerHtml;
		}
		
		let productionInnerHtml = "<li><b>"+getLocale(product.id)+"</b></li>";


		if(product.cycleProduction)
		{
			productionInnerHtml = "<li><b>"+getLocale(product.id)+"</b>: <font style='color:yellow'>"+ product.cycleProduction +"</font> "+getUiLocale("per_cycle")+" (<font style='color:yellow'>"+product.cycleProduction*cyclesPerHour+"</font> "+getUiLocale("per_hour")+")</li>" + "\n";
			let mm = Math.floor(product.cycleDuration / 60);
			let ss = ("0" + product.cycleDuration % 60).slice(-2);
			productionInnerHtml = productionInnerHtml + "<li><b>"+getUiLocale("cycle_duration")+"</b>: <font style='color:yellow'>"+ mm + ":" + ss +"</font></li>" + "\n";
		} 

		let faction = getUiLocale(product.faction ? product.faction : 'common'); 

		productionInnerHtml = productionInnerHtml + "<li><b>"+getUiLocale("faction")+"</b>: <font style='color:yellow'>"+ faction +"</font></li>" + "\n";
		production_list.innerHTML = productionInnerHtml;

		let ancestors = getAncestorsToShow(productId);

		console.log(ancestors);

		let ancestorsListInnerHtml="";

		ancestors.forEach(ancestor=>{
			ancestorsListInnerHtml+="<div><a href='"+baseUrl+"?product="+ancestor.id+"' class='btn btn-outline-secondary' style='margin:1px; height:28px; padding-top:0px'>"+getLocale(ancestor.id)+"</a></div>";
		});

		if(!ancestorsListInnerHtml)
		{
			ancestorsListInnerHtml = "-";
		}

		ancestors_list.innerHTML = ancestorsListInnerHtml;

}

function updateUrl(productId)
{
	let url = baseUrl + '?product=' + productId;

	history.pushState(null, null, url);
}

function getAncestorsToShow(productId)
{
	console.log(allProducts);
	return allProducts.filter(c=>c.precursors.findIndex(p=>p.id == productId) >= 0);
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
	
function loadProductsL18n(locale)
{
  return fetch("./l18n/"+locale+".json")
	.then((response) => response.json())
    .then((data) =>{return data.localization})
	.catch(error => console.warn(error));
}

function loadUIL18n(locale)
{
  return fetch("./l18n/ui_"+locale+".json")
	.then((response) => response.json())
    .then((data) =>{return data.localization})
	.catch(error => console.warn(error));
}

function getLocale(id)
{
	let result = l18n.find(c=>c.id == id);
	return result?.value ?? id;
}

function getUiLocale(id)
{
	let result = uil18n.find(c=>c.id == id);
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
	let dx = (canvas.width /2) - ((hStep * products.length) / 2 - 55)

	let maxProductsInTier = 1;
	if(products.length>1)
	{
		for (let tier = 1; tier < products.length; tier++)
		{
			if(products[tier].length > maxProductsInTier)
			{
				maxProductsInTier = products[tier].length;
			}
		}
	}

	for (let tier = 0; tier < products.length; tier++)
	{
		let innerArrayLength = products[tier].length;
		let dy = (canvas.height / 2) - (vStep * (innerArrayLength-1) / 2);

		for (let productIndex = 0; productIndex < innerArrayLength; productIndex++) {
			let x = hStep * tier + dx;
			let y = vStep * productIndex + dy;

			if(products[tier][productIndex].id == 'energy_cells' && maxProductsInTier > 1)
			{
				y = vStep * (maxProductsInTier) + dy;
			}

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
	context.strokeStyle = tgt.selected ? src.color : '#555555';
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
	context.lineTo(x+blockSlope, y-blockSlope);
	context.lineTo(x+blockWidth, y-blockSlope);
	context.lineTo(x+blockWidth+blockSlope, y);
	context.lineTo(x+blockWidth, y+blockSlope);
	context.lineTo(x+blockSlope, y+blockSlope);
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

function adaptCursorToCanvasCoords(point) 
{
	const scrollX = canvasContainer.scrollLeft + window.scrollX;
	const scrollY = canvasContainer.scrollTop + window.scrollY;
	const mouseX = point.x - canvas.offsetLeft + scrollX;
	const mouseY = point.y - canvas.offsetTop + scrollY;
	const resultX = mouseX * canvas.width / canvas.clientWidth;
	const resultY = mouseY * canvas.height / canvas.clientHeight;
	return {x:resultX, y:resultY};
}

function onDoubleClick(e)
{
	var point = adaptCursorToCanvasCoords({x:e.pageX, y: e.pageY});
	productsToRender.forEach(product=>{
		if(productClicked(point, product))
		{
			showProduct(product.id);
		}
	});
}

function onSelect(e){
	var point = adaptCursorToCanvasCoords({x:e.clientX, y:e.clientY});

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
		&& point.y > product.input.y - blockSlope
		&& point.y < product.output.y + blockSlope;
}

function fillCanvas(color)
{
	context.fillStyle = color;
	context.fillRect(0,0,canvas.width,canvas.height);
}

function centerCanvasScroll()
{
	if(canvasContainer)
	{
		const x = canvas.offsetWidth/2 - canvasContainer.offsetWidth/2;
		const y = canvas.offsetHeight/2-canvasContainer.offsetHeight/2;
		canvasContainer.scrollTo(x, y);
	}
}

function onResize()
{
	needRedraw = true;
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
