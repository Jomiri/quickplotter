var margin = {top: 50, right: 40, bottom: 100, left: 100};
var axMargin = {x: 0.0, y: 0.05};
var selector = '#figure_area';

const defaultPlotStyle = {
    'plotType': 'line',
    'majorTickSize': 7,
    'minorTickSize': 4,
    'axisStrokeWidth': '3px',
    'axisFontSize': '16px',
    'xLabelFontSize': '20px',
    'yLabelFontSize': '20px',
    'titleFontSize': '24px',
    'xScaling': 1.0,
    'yScaling': 1.0,
    'xStart': 'auto',
    'xEnd': 'auto',
    'yStart': 'auto',
    'yEnd': 'auto',
    'scatterDotRadius': 5,
    'lineStrokeWidth': '2px', 
    'dataColor': 'black'
}

var currentPlotStyle = Object.assign({}, defaultPlotStyle);

/*
var majorTickSize = 7;
var minorTickSize = 4;
var axisStrokeWidth = 3;
var axisFontSize = '1em';
var lineStrokeWidth = '2px';
var labelFontSize = '1.5em';
*/
var xyG = [];
var fileNameG = '';
var canvasResFactor = 4;
var imageWidthFraction = 0.7;
var imageHeightFraction = 1;
var axisFont = 'Sans-Serif';
var nTicks = 5;

// https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop
function dropHandler(ev) {
    ev.preventDefault();
    if (ev.dataTransfer.items) {
        for (var i = 0; i < ev.dataTransfer.items.length; i++) {
           if (ev.dataTransfer.items[i].kind === 'file') {
               var file = ev.dataTransfer.items[i].getAsFile();
               fileHandler(file);
           }
       } 
    }
    removeDragData(ev);
}

function dragOverHandler(ev) {
    ev.stopPropagation();
    ev.preventDefault();
}

function removeDragData(ev) {
    if (ev.dataTransfer.items) {
        ev.dataTransfer.items.clear();
    }
    else {
        ev.dataTransfer.clearData();
    }
}

// https://www.html5rocks.com/en/tutorials/file/dndfiles/
function fileHandler(file) {
    var reader = new FileReader();
    reader.onload = (function (dataFile) { return function(e) 
        { parseAndPlot(e.target.result, file.name); }; }) ();
    reader.readAsText(file);
}

function parseAndPlot(str, fileName) {
    var xy = regexParse(str);
    saveTempData(xy, fileName);
    resetLimits();
    plotXY(xy, margin, axMargin, selector, fileName);
    hideInstruction(selector);
}

// https://stackoverflow.com/questions/2176861/javascript-get-clipboard-data-on-paste-event-cross-browser
function readPasteAndPlot(e) {
    var clipboardData, pastedData;
    var fileName = 'pasted_data';

    e.stopPropagation();
    e.preventDefault();

    clipboardData = e.clipboardData || window.clipboardData;
    pastedData = clipboardData.getData('Text');
    parseAndPlot(pastedData, fileName);
} 

function saveTempData(xy, fileName) {
    var fig_area = document.getElementById('figure_area');
    xyG = xy;
    fileNameG = fileName;
}

function redraw(selector) {
    plotXY(xyG, margin, axMargin, selector, fileNameG);
}

function scaleArray(arr, multiplier) {
    for (var i = 0; i < arr.length; i++) {
        arr[i] *= multiplier;
    } 
}

function getCoordinateLimits(dataArr, margin, userLimits) {
    var span = getAxSpan(dataArr);
    var lim = [d3.min(dataArr) - span * margin, d3.max(dataArr) + span * margin];
    if (userLimits[0] !== 'auto') {
        lim[0] = toFloat(userLimits[0]);
    }
    if (userLimits[1] !== 'auto') {
        lim[1] = toFloat(userLimits[1]);
    }
    return lim;
}

function plotXY(xy, margin, axMargin, selector, fileName) {

    if (xy.length === 0) { return; }

    resetFigure();
    updatePlotStyle();

    var size = getAxisSize(margin);
    var width = size.width;
    var height = size.height;

    var x = xy[0].slice();
    var y = xy[1].slice();

    scaleArray(x, currentPlotStyle['xScaling']);
    scaleArray(y, currentPlotStyle['yScaling']);
    
    var lineData = makeLineData(x, y);

    var xLim = getCoordinateLimits(x, axMargin.x, [currentPlotStyle['xStart'], currentPlotStyle['xEnd']]);
    var yLim = getCoordinateLimits(y, axMargin.y, [currentPlotStyle['yStart'], currentPlotStyle['yEnd']]);

    var xScale = d3.scaleLinear()
                    .domain(xLim)
                    .range([0, width]);

    var yScale = d3.scaleLinear()
                    .domain(yLim)
                    .range([height, 0])

    var xMajorTickValues = xScale.ticks(nTicks);
    var yMajorTickValues = yScale.ticks(nTicks);

    var xTickFormat = getTickFormat(xMajorTickValues);
    var yTickFormat = getTickFormat(yMajorTickValues);

    var xTickValues = addMinorTicks(xMajorTickValues, xLim);
    var yTickValues = addMinorTicks(yMajorTickValues, yLim);


    // Create the svg element
    var svgWidth = width + margin.right + margin.left;
    var svgHeight = height + margin.top + margin.bottom;
    var figure = d3.select(selector)
    .append('svg')
    .attr('version', '1.1')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('width', svgWidth)
    .attr('height', svgHeight)
    .attr('viewBox', '0 0 ' + svgWidth + ' ' + svgHeight)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .attr('class', 'figure')
    .attr('id', 'figure')
    .attr('data-filename', stripFileExtension(fileName));

    // Create an inner element to hold the axes
    var ax = figure.append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'ax')
    .attr('id', 'ax');

    // Define axes
    var xAxis = d3.axisBottom(xScale)
        .tickSize(0, 0)
        //.ticks(nTicks)
        .tickValues(xTickValues)
        .tickFormat(xTickFormat);

    var yAxis = d3.axisLeft(yScale)
        .tickSize(0, 0)
        //.ticks(nTicks)
        .tickValues(yTickValues)
        .tickFormat(yTickFormat);

    var xAxisTop = d3.axisTop(xScale)
        .tickSize(0, 0)
        .tickValues(xTickValues);

    var yAxisRight = d3.axisRight(yScale)
        .tickSize(0, 0)
        .tickValues(yTickValues);



    ax.append('clipPath')
    .attr('id', 'clip_path')
    .append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', width)
        .attr('height', height);
    
    drawData(lineData, ax, xScale, yScale);

    // Add axes to the ax group
    ax.append('g')
    .attr('transform', 'translate(0,' + height + ')')
    .attr('class', 'x_axis')
    .attr('stroke-width', currentPlotStyle['axisStrokeWidth'])
    .style('font-family', axisFont)
    .style('font-size', currentPlotStyle['axisFontSize'])
    .call(xAxis);

    ax.append('g')
    .attr('transform', 'translate(0,0)')
    .attr('class', 'y_axis')
    .attr('stroke-width', currentPlotStyle['axisStrokeWidth'])
    .style('font-family', axisFont)
    .style('font-size', currentPlotStyle['axisFontSize'])
    .call(yAxis);

    ax.append('g')
    .attr('transform', 'translate(0,0)')
    .attr('class', 'x_axis_top')
    .attr('stroke-width', currentPlotStyle['axisStrokeWidth'])
    .call(xAxisTop);

    ax.append('g')
    .attr('transform', 'translate(' + width + ',0)')
    .attr('class', 'y_axis_right')
    .attr('stroke-width', currentPlotStyle['axisStrokeWidth'])
    .call(yAxisRight);

    // Major and minor tick line formatting
    var xTickLines = d3.selectAll('.x_axis .tick line');
    var xTickLinesTop = d3.selectAll('.x_axis_top .tick line');
    var yTickLines = d3.selectAll('.y_axis .tick line');
    var yTickLinesRight = d3.selectAll('.y_axis_right .tick line');

    var majorTickSize = currentPlotStyle['majorTickSize'];
    var minorTickSize = currentPlotStyle['minorTickSize'];
    xTickLines.attr('y2', function (d, i) { return (i % 2 === 0) ? -majorTickSize : -minorTickSize; });
    xTickLinesTop.attr('y2', function (d, i) { return (i % 2 === 0) ? majorTickSize : minorTickSize; });
    yTickLines.attr('x2', function (d, i) { return (i % 2 === 0) ? majorTickSize : minorTickSize; });
    yTickLinesRight.attr('x2', function (d, i) { return (i % 2 === 0) ? -majorTickSize : -minorTickSize; });
 

    // Tick label formatting
    var xTickLabels = d3.selectAll('.x_axis .tick text');
    var yTickLabels = d3.selectAll('.y_axis .tick text');
    var xTickLabelsTop = d3.selectAll('.x_axis_top .tick text');
    var yTickLabelsRight = d3.selectAll('.y_axis_right .tick text');

    // Main X and Y axes: remove minor tick labels
    xTickLabels.attr('class', function(d, i) { if (i%2 != 0) d3.select(this).remove(); });
    yTickLabels.attr('class', function(d, i) { if (i%2 != 0) d3.select(this).remove(); });

    // Secondary axes: remove all tick labels
    xTickLabelsTop.attr('class', function (d, i) { d3.select(this).remove(); });
    yTickLabelsRight.attr('class', function (d, i) { d3.select(this).remove(); });

    // Move printed labels away from the axis
    xTickLabels.attr('transform', 'translate(0,5)');
    yTickLabels.attr('transform', 'translate(-5,0)');
    addXLabel(document.getElementById('xLabel').value);
    addYLabel(document.getElementById('yLabel').value);
    addTitle(document.getElementById('title').value);
}

function drawData(dataPoints, ax, xScale, yScale) {

    var plotType = currentPlotStyle['plotType'];
    if (plotType === 'line') {
        var drawFunc = d3.line()
            .x(function(d) { return xScale(d.x_coord); })
            .y(function(d) { return yScale(d.y_coord); });
        // Add the plotted curve as path
        ax.append('path')
        .attr('d', drawFunc(dataPoints))
        .attr('class', 'curve')
        .attr('fill', 'none')
        .attr('stroke', currentPlotStyle['dataColor'])
        .attr('clip-path', 'url(#clip_path)')
        .attr('stroke-width', currentPlotStyle['lineStrokeWidth']);

    } else if (plotType === 'scatter') {
        var scatterPlot = ax.append('g')
        .attr('class', 'curve')
        .attr('id', 'scatterPlot')
        .attr('clip-path', 'url(#clip_path)');

        scatterPlot.selectAll('scatter-dots')
        .data(dataPoints)
        .enter().append('circle')
            .attr('class', 'scatter_dot')
            .attr('cx', function (d) { return xScale(d.x_coord); })
            .attr('cy', function (d) { return yScale(d.y_coord); })
            .attr('r', currentPlotStyle['scatterDotRadius'])
            .attr('fill', currentPlotStyle['dataColor']);
    }
}
function addTitle(titleText) {
    var size = getAxisSize(margin);
    var width = size.width;
    var center = Math.floor(width / 2);
    var axis = d3.select('#ax');
    axis.selectAll('.title').remove();
    axis.append('text')
    .attr('class', 'title')
    .attr('text-anchor', 'middle')
    .attr('x', center)
    .attr('y', -20)
    .attr('font-family', axisFont)
    .attr('font-size', currentPlotStyle['titleFontSize'])
    .text(titleText);
}

function addXLabel(labelText) {
    var size = getAxisSize(margin);
    var width = size.width;
    var height = size.height;
    var center = Math.floor(width / 2);
    var axis = d3.select('#ax');
    axis.selectAll('.x_label').remove();
    axis.append('text')
    .attr('class', 'x_label')
    .attr('text-anchor', 'middle')
    .attr('x', center)
    .attr('y', height + 50)
    .attr('font-family', axisFont)
    .attr('font-size', currentPlotStyle['xLabelFontSize'])
    .text(labelText);
}

function addYLabel(labelText) {
    var size = getAxisSize(margin);
    var width = size.width;
    var height = size.height;
    var center = Math.floor(height / 2);
    var axis = d3.select('#ax');
    axis.selectAll('.y_label').remove();
    axis.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('class', 'y_label')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('y', -75)
    .attr('x', -center)
    .attr('dy', '0.75em')
    .attr('font-family', axisFont)
    .attr('font-size', currentPlotStyle['yLabelFontSize'])
    .text(labelText);
}


function regexParse(str) {
    var row_re = /^\s*([+-]?[0-9]+(\.|,)?[0-9]*([eE][-+]?[0-9]+)?)(\t|,|[\s]+)\s?([+-]?[0-9]+(\.|,)?[0-9]*([eE][-+]?[0-9]+)?)\s?$/mg;
    var arr;
    var x = [];
    var y = [];
    while (arr = row_re.exec(str)) {
        x.push(toFloat(arr[1]));
        y.push(toFloat(arr[5]));
    }
    return [x, y];
}

function downloadSVG() {
    var svgFileName = getFileName() + '.svg';
    var svgUrl = getSvgUrl();
    var svg = getSvgFigure();
    var downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = svgFileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

function downloadPNG() {
    var pngFileName = getFileName() + '.png';
    var svgUrl = getSvgUrl();
    var svg = getSvgFigure();
    var canvas = document.getElementById('cvs');
    canvas.width = svg.width.animVal.value * canvasResFactor;
    canvas.height = svg.height.animVal.value * canvasResFactor;
    var ctx = canvas.getContext('2d');
    var img = new Image;


    img.onload = function() {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        canvas.toBlob(function(blob) {
            saveAs(blob, pngFileName);
        });
    }
    img.src = svgUrl;
}

function getSvgUrl() {
    //get svg element.
    var svg = getSvgFigure();

    //get svg source.
    var serializer = new XMLSerializer();
    var source = serializer.serializeToString(svg);

    //add name spaces.
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
        source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }

    //add xml declaration
    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;

    //convert svg source to URI data scheme.
    var url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
    return url;
}

function getSvgFigure() {
    return document.getElementById('figure');

}

// Helper funcs

function getAxisSize(margin) {
    var figHeight = document.getElementById('figure_area').offsetHeight;//Math.floor(window.innerHeight * imageHeightFraction);
    var figWidth = document.getElementById('figure_area').offsetWidth;//Math.floor(window.innerWidth * imageWidthFraction);
    var width = figWidth - margin.left - margin.right
    var height = figHeight - margin.top - margin.bottom;
    return {width: width, height: height};
}

function toFloat(num_str) {
    return parseFloat(num_str.replace(/,/, '.'));
}

function makeLineData(x, y) {
    var lineData = [];
    for (var i = 0; i < x.length; i++) {
        var point = {x_coord: x[i], y_coord: y[i]};
        lineData.push(point);
    }
    return lineData;
}

function hideInstruction() {
    var instruction = document.getElementById('instruction_text');
    instruction.style.visibility = 'hidden';
    document.getElementById('figure_area').style.borderStyle = 'hidden';
}



function addMinorTicks(majorTicks, limits) {
    var tickSize = (majorTicks[1] - majorTicks[0]) / 2;
    var potentialFirstTick = majorTicks[0] - tickSize;
    var potentialLastTick = majorTicks[majorTicks.length - 1] + tickSize;
    var firstTick = (potentialFirstTick >= limits[0]) ? potentialFirstTick : majorTicks[0];
    var lastTick = (potentialLastTick <= limits[1]) ? potentialLastTick : majorTicks[majorTicks.length - 1];
    return d3.range(firstTick, lastTick + tickSize / 10, tickSize);
}

function getTickFormat(ticks) {
    var range = ticks[ticks.length - 1] - ticks[0];
    var orderOfMagn = Math.floor(Math.log10(Math.max(Math.abs(ticks[0]), Math.abs(ticks[ticks.length-1]))));
    var formatString = '';
    console.log(orderOfMagn);
    if (ticks.every(numIsInteger)) {
        formatString = 'd';
    }
    else if (orderOfMagn < -2) {
        formatString = '.1e';
    }
    else if (orderOfMagn <= 0) {
        formatString = '.' + (Math.abs(orderOfMagn)+1) + 'f';
    }
    else if (orderOfMagn < 4) {
        formatString = '.1f';
    }
    else {
        formatString = '.1e';
    }
    return d3.format(formatString);
}

function getFileName() {
    return document.getElementById('figure').dataset.filename;
}

function resetFigure() {
    if (document.getElementById('figure')) {
        d3.select('svg').remove();
    }
}

function stripFileExtension(fileName) {
    // https://stackoverflow.com/questions/4250364/how-to-trim-a-file-extension-from-a-string-in-javascript
    return fileName.replace(/\.[^/.]+$/, "");
}

function getAxSpan(arr) {
    return Math.abs(d3.max(arr) - d3.min(arr));
}

function numIsInteger(num) {
    return num % 1 === 0;
}

function appendStrtoArr(arr, str) {
    var output = [];
    for (var i = 0; i < arr.length; i++) {
        output.push(arr[i] + str);
    }
    return output;
}

function initSideBar() {
    var fontSizesInt = d3.range(10, 52 ,2);
    var fontSizesStr = appendStrtoArr(fontSizesInt, 'px');

    var strokeWidths = appendStrtoArr(d3.range(0.5, 5.5, 0.5), 'px');
    var dotRadii = d3.range(1, 10, 0.5);
    


    populateSelectBox('xFontSize', fontSizesStr);
    populateSelectBox('yFontSize', fontSizesStr);
    populateSelectBox('titleFontSize', fontSizesStr);
    populateSelectBox('lineStrokeWidth', strokeWidths);
    populateSelectBox('scatterDotRadius', dotRadii);

    document.getElementById('xFontSize').value = defaultPlotStyle['xLabelFontSize'];
    document.getElementById('yFontSize').value = defaultPlotStyle['yLabelFontSize'];
    document.getElementById('titleFontSize').value = defaultPlotStyle['titleFontSize'];
    document.getElementById('xScaling').value = defaultPlotStyle['xScaling'];
    document.getElementById('yScaling').value = defaultPlotStyle['yScaling'];
    document.getElementById('lineStrokeWidth').value = defaultPlotStyle['lineStrokeWidth']
    document.getElementById('scatterDotRadius').value = defaultPlotStyle['scatterDotRadius']
    
    resetLimits();

    document.getElementById('plotType').value = defaultPlotStyle['plotType'];


    document.getElementById('svgButton').addEventListener('click', downloadSVG);
    document.getElementById('pngButton').addEventListener('click', downloadPNG);

    document.getElementById('xFontSize').addEventListener('change', function(event) {redraw(selector);});
    document.getElementById('yFontSize').addEventListener('change', function(event) {redraw(selector);});
    document.getElementById('titleFontSize').addEventListener('change', function(event) {redraw(selector);});

    document.getElementById('xScaling').addEventListener('change', function(event) {redraw(selector);});
    document.getElementById('yScaling').addEventListener('change', function(event) {redraw(selector);});

    document.getElementById('xStart').addEventListener('change', function(event) {redraw(selector);});
    document.getElementById('xEnd').addEventListener('change', function(event) {redraw(selector);});

    document.getElementById('yStart').addEventListener('change', function(event) {redraw(selector);});
    document.getElementById('yEnd').addEventListener('change', function(event) {redraw(selector);});

    document.getElementById('plotType').addEventListener('change', function (event) { redraw(selector); });
    document.getElementById('dataColor').addEventListener('change', function (event) { redraw(selector); });

    document.getElementById('lineStrokeWidth').addEventListener('change', function (event) { redraw(selector); });
    document.getElementById('scatterDotRadius').addEventListener('change', function (event) { redraw(selector); });

    document.getElementById('xLabel').addEventListener('input', function (event) {
        addXLabel(document.getElementById('xLabel').value); })
    document.getElementById('yLabel').addEventListener('input', function (event) {
        addYLabel(document.getElementById('yLabel').value); })
    document.getElementById('title').addEventListener('input', function (event) {
        addTitle(document.getElementById('title').value); })
}

function resetLimits() {
    document.getElementById('xStart').value = defaultPlotStyle['xStart'];
    document.getElementById('xEnd').value = defaultPlotStyle['xEnd'];
    document.getElementById('yStart').value = defaultPlotStyle['yStart'];
    document.getElementById('yEnd').value = defaultPlotStyle['yEnd'];
}

//https://stackoverflow.com/questions/9895082/javascript-populate-drop-down-list-with-array
function populateSelectBox(idSelector, optionArray) {
    var box = document.getElementById(idSelector);
    for(var i = 0; i < optionArray.length; i++) {
        var option = optionArray[i];
        var el = document.createElement('option');
        el.textContent = option;
        el.value = option;
        box.appendChild(el);
    }
}

function updatePlotStyle() {
    currentPlotStyle['xLabelFontSize'] = document.getElementById('xFontSize').value; 
    currentPlotStyle['yLabelFontSize'] = document.getElementById('yFontSize').value; 
    currentPlotStyle['titleFontSize'] = document.getElementById('titleFontSize').value; 

    currentPlotStyle['xScaling'] = toFloat(document.getElementById('xScaling').value); 
    currentPlotStyle['yScaling'] = toFloat(document.getElementById('yScaling').value); 

    currentPlotStyle['xStart'] = document.getElementById('xStart').value; 
    currentPlotStyle['xEnd'] = document.getElementById('xEnd').value; 

    currentPlotStyle['yStart'] = document.getElementById('yStart').value; 
    currentPlotStyle['yEnd'] = document.getElementById('yEnd').value; 

    currentPlotStyle['plotType'] = document.getElementById('plotType').value;
    currentPlotStyle['dataColor'] = document.getElementById('dataColor').value;
    currentPlotStyle['lineStrokeWidth'] = document.getElementById('lineStrokeWidth').value;
    currentPlotStyle['scatterDotRadius'] = document.getElementById('scatterDotRadius').value;
}

initSideBar();
document.getElementById('figure_area').addEventListener('paste', readPasteAndPlot);
window.addEventListener('resize', function(event) {redraw(selector);});
