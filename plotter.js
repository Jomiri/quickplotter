var margin = {top: 20, right: 40, bottom: 50, left: 100};
var axMargin = {x: 0.0, y: 0.05};
var selector = '#figure_area';
var majorTickSize = 7;
var minorTickSize = 4;
var axisStrokeWidth = 3;
var axisFontSize = '1em';
var axisFont = 'Sans-Serif';
var canvasResFactor = 2;
var imageSizeFraction = 0.8;
var lineStrokeWidth = '2px';
var nTicks = 5;
var labelFontSize = '1.5em';
var xyG = [];
var fileNameG = '';

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

function plotXY(xy, margin, axMargin, selector, fileName) {

    if (xy.length === 0) { return; }

    resetFigure();

    var size = getAxisSize(margin);
    var width = size.width;
    var height = size.height;

    var x = xy[0];
    var y = xy[1];
    var lineData = makeLineData(x, y);

    var xSpan = getAxSpan(x);
    var ySpan = getAxSpan(y);

    var xLim = [d3.min(x) - xSpan * axMargin.x, d3.max(x) + xSpan * axMargin.x];
    var yLim = [d3.min(y) - ySpan * axMargin.y, d3.max(y) + ySpan * axMargin.y];


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

    // Add axes to the ax group
    ax.append('g')
    .attr('transform', 'translate(0,' + height + ')')
    .attr('class', 'x_axis')
    .attr('stroke-width', axisStrokeWidth)
    .style('font-family', axisFont)
    .style('font-size', axisFontSize)
    .call(xAxis);

    ax.append('g')
    .attr('transform', 'translate(0,0)')
    .attr('class', 'y_axis')
    .attr('stroke-width', axisStrokeWidth)
    .style('font-family', axisFont)
    .style('font-size', axisFontSize)
    .call(yAxis);

    ax.append('g')
    .attr('transform', 'translate(0,0)')
    .attr('class', 'x_axis_top')
    .attr('stroke-width', axisStrokeWidth)
    .call(xAxisTop);

    ax.append('g')
    .attr('transform', 'translate(' + width + ',0)')
    .attr('class', 'y_axis_right')
    .attr('stroke-width', axisStrokeWidth)
    .call(yAxisRight);

    // Define the plot type - here line
    var drawLine = d3.line()
        .x(function(d) { return xScale(d.x_coord); })
        .y(function(d) { return yScale(d.y_coord); });

    // Add the plotted curve as path
    ax.append('path')
    .attr('d', drawLine(lineData))
    .attr('class', 'curve')
    .attr('fill', 'none')
    .attr('stroke', 'black')
    .attr('stroke-width', lineStrokeWidth);

    // Major and minor tick line formatting
    var xTickLines = d3.selectAll('.x_axis .tick line');
    var xTickLinesTop = d3.selectAll('.x_axis_top .tick line');
    var yTickLines = d3.selectAll('.y_axis .tick line');
    var yTickLinesRight = d3.selectAll('.y_axis_right .tick line');

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
    .attr('y', height + 45)
    .attr('font-family', axisFont)
    .attr('font-size', labelFontSize)
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
    .attr('y', -90)
    .attr('x', -center)
    .attr('dy', '0.75em')
    .attr('font-family', axisFont)
    .attr('font-size', labelFontSize)
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
    var figHeight = Math.floor(window.innerHeight * imageSizeFraction);
    var figWidth = Math.floor(window.innerWidth * imageSizeFraction);
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
    var orderOfMagn = Math.floor(Math.log10(Math.abs(range)));
    var formatString = '';
    if (ticks.every(numIsInteger)) {
        formatString = 'd';
    }
    else if (Math.abs(orderOfMagn) < 3) {
        formatString = '.' + (Math.abs(orderOfMagn)+1) + 'f';
    }
    else {
        formatString = '.2e';
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

document.getElementById('figure_area').addEventListener('paste', readPasteAndPlot);
document.getElementById('xLabel').addEventListener('input', function (event) {
    addXLabel(document.getElementById('xLabel').value); })
document.getElementById('yLabel').addEventListener('input', function (event) {
    addYLabel(document.getElementById('yLabel').value); })
document.getElementById('svgButton').addEventListener('click', downloadSVG);
document.getElementById('pngButton').addEventListener('click', downloadPNG);
window.addEventListener('resize', function(event) {redraw(selector);});
