/* global FileReader */
/* global Image */
/* global saveAs */
/* global XMLSerializer */
/* global d3 */

const defaultPlotStyle = {
  'plotType': 'line',
  'majorTickSize': 0.6, // %
  'minorTickSize': 0.4, // %
  'axisStrokeWidth': '0.4%',
  'axisFontSize': 1.3, // %
  'xLabelFontSize': 1.5,
  'yLabelFontSize': 1.5,
  'titleFontSize': 2, // %
  'xScaling': 1.0,
  'yScaling': 1.0,
  'xStart': 'auto',
  'xEnd': 'auto',
  'yStart': 'auto',
  'yEnd': 'auto',
  'scatterDotRadius': 5,
  'lineStrokeWidth': '3',
  'dataColor': 'black',
  'graphMarginX': 0.05,
  'graphMarginY': 0.05
};

var currentPlotStyle = Object.assign({}, defaultPlotStyle);

var xyG = [];
var fileNameG = '';
var canvasResFactor = 1;
var axisFont = 'Sans-Serif';
var nTicks = 5;

class Figure {
  constructor (parentSelector) {
    this.ax = undefined;
    this.parentSelector = parentSelector;
    this.selector = '#figure';
    this.marginPercent = {
      top: 0.05,
      bottom: 0.05,
      left: 0.08,
      right: 0.02
    };
  }

  get svgElement () {
    return d3.select(this.selector);
  }

  get parentElement () {
    return document.querySelector(this.parentSelector);
  }

  get width () {
    return this.parentElement.offsetWidth;
  }

  get height () {
    return this.parentElement.offsetHeight;
  }

  get diagonal () {
    return Math.hypot(this.height, this.width);
  }

  svgPercentageToPxInt (percentage) {
    return Math.floor(0.01 * percentage * this.diagonal);
  }

  svgPercentageToPx (percentage) {
    return this.svgPercentageToPxInt(percentage) + 'px';
  }

  axMargin () {
    var diag = this.diagonal;
    var margin = {
      top: Math.floor(this.marginPercent.top * diag),
      bottom: Math.floor(this.marginPercent.bottom * diag),
      left: Math.floor(this.marginPercent.left * diag),
      right: Math.floor(this.marginPercent.right * diag)
    };
    return margin;
  }

  axWidth () {
    return this.width - this.axMargin().left - this.axMargin().right;
  }

  axHeight () {
    return this.height - this.axMargin().top - this.axMargin().bottom;
  }

  addAxis () {
    var ax = new Axis(this.axWidth(), this.axHeight(), this);
    this.ax = ax;
    return ax;
  }

  draw () {
    var svg;
    if (document.querySelector(this.selector)) {
      svg = this.svgElement;
    } else {
      svg = d3.select(this.parentSelector)
        .append('svg');
    }
    //var figureElem = d3.select(this.parentSelector)
    //  .append('svg')
    svg.attr('version', '1.1')
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('viewBox', '0 0 ' + this.width + ' ' + this.height)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('class', 'figure')
      .attr('id', 'figure');

    // Create an inner element to hold the axes
    var axElem = svg.append('g')
      .attr('transform', 'translate(' + this.axMargin().left + ',' + this.axMargin().top + ')')
      .attr('width', this.axWidth())
      .attr('height', this.axHeight())
      .attr('class', 'ax')
      .attr('id', 'ax');

    this.ax.draw(axElem);
  }

  reset () {
    if (this.svgElement) {
      d3.select('.ax').remove();
    }
  }
};

class Axis {
  constructor (width, height, parentFig) {
    this.width = width;
    this.height = height;
    this.parentFig = parentFig;
    this.graph = undefined;
    this.xScale = undefined;
    this.yScale = undefined;
    this.axElem = undefined;
  }

  plot (x, y) {
    this.graph = new Graph(x, y);
    return this.graph;
  }

  draw (axElem) {
    this.axElem = axElem;
    this.xScale = d3.scaleLinear()
      .domain(this.xLim())
      .range([0, this.width]);

    this.yScale = d3.scaleLinear()
      .domain(this.yLim())
      .range([this.height, 0]);

    this.drawClipPath(axElem);
    this.graph.draw(axElem, this.xScale, this.yScale);

    this.drawCoordAxis(axElem, this.xScale, this.xLim(), 'bottom', [0, this.height], 'x_axis', true, [0, 5]);
    this.drawCoordAxis(axElem, this.xScale, this.xLim(), 'top', [0, 0], 'x_axis_top', false, [0, 0]);
    this.drawCoordAxis(axElem, this.yScale, this.yLim(), 'left', [0, 0], 'y_axis', true, [-5, 0]);
    this.drawCoordAxis(axElem, this.yScale, this.yLim(), 'right', [this.width, 0], 'y_axis_right', false, [0, 0]);
  }

  drawCoordAxis (axElem, scale, limits, orientation, translatePosition, htmlClass, tickLabelsVisible, labelTranslate) {
    var cAx = new CoordAxis(orientation);
    var majorTickSize = this.parentFig.svgPercentageToPxInt(currentPlotStyle['majorTickSize']);
    var minorTickSize = this.parentFig.svgPercentageToPxInt(currentPlotStyle['minorTickSize']);
    var axisFontSize = this.parentFig.svgPercentageToPx(currentPlotStyle['axisFontSize']);
    cAx.draw(axElem, scale, limits, htmlClass, translatePosition, tickLabelsVisible, labelTranslate, majorTickSize,
      minorTickSize, axisFontSize);
  }

  drawClipPath (axElem) {
    axElem.append('clipPath')
      .attr('id', 'clip_path')
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', this.width)
      .attr('height', this.height);
  }

  addTitle (titleText, fontSize) {
    var center = Math.floor(this.width / 2);
    var axis = d3.select('#ax');
    axis.selectAll('.title').remove();
    axis.append('text')
      .attr('class', 'title')
      .attr('text-anchor', 'middle')
      .attr('x', center)
      .attr('y', -this.parentFig.svgPercentageToPxInt(1))
      .attr('font-family', axisFont)
      .attr('font-size', fontSize)
      .text(titleText);
  }

  addXLabel (labelText, fontSize) {
    var center = Math.floor(this.width / 2);
    var axis = d3.select('#ax');
    axis.selectAll('.x_label').remove();
    axis.append('text')
      .attr('class', 'x_label')
      .attr('text-anchor', 'middle')
      .attr('x', center)
      .attr('y', this.height + this.parentFig.svgPercentageToPxInt(4))
      .attr('font-family', axisFont)
      .attr('font-size', fontSize)
      .text(labelText);
  }

  addYLabel (labelText, fontSize) {
    var center = Math.floor(this.height / 2);
    var axis = d3.select('#ax');
    axis.selectAll('.y_label').remove();
    axis.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('class', 'y_label')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('y', -this.parentFig.svgPercentageToPxInt(5))
      .attr('x', -center)
      .attr('dy', '0.75em')
      .attr('font-family', axisFont)
      .attr('font-size', fontSize)
      .text(labelText);
  }

  xLim () {
    var userLimits = [currentPlotStyle['xStart'], currentPlotStyle['xEnd']];
    return this.getCoordinateLimits(this.graph.xLim(), userLimits);
  }

  yLim () {
    var userLimits = [currentPlotStyle['yStart'], currentPlotStyle['yEnd']];
    return this.getCoordinateLimits(this.graph.yLim(), userLimits);
  }

  getCoordinateLimits (dataLimits, userLimits) {
    var lim = dataLimits;
    if (userLimits[0] !== 'auto') {
      lim[0] = toFloat(userLimits[0]);
    }
    if (userLimits[1] !== 'auto') {
      lim[1] = toFloat(userLimits[1]);
    }
    return lim;
  }
};

class CoordAxis {
  constructor (orientation) {
    this.orientation = orientation;
  }

  draw (axElem, scale, limits, htmlClass, translatePosition, tickLabelsVisible, labelTranslate,
    majorTickSize, minorTickSize, axisFontSize) {
    var majorTickValues = scale.ticks(nTicks);
    var tickValues = this.addMinorTicks(majorTickValues, limits);
    var tickFormat = this.getTickFormat(majorTickValues);

    var axis = this.makeAxisFunc(scale, tickValues, tickFormat);

    majorTickSize *= this.getTickDirection();
    minorTickSize *= this.getTickDirection();

    // Add axes to the ax group
    axElem.append('g')
      .attr('transform', 'translate(' + translatePosition[0] + ',' + translatePosition[1] + ')')
      .attr('class', htmlClass)
      .attr('stroke-width', currentPlotStyle['axisStrokeWidth'])
      .style('font-family', axisFont)
      .style('font-size', axisFontSize)
      .call(axis);

    this.drawTickLines('.' + htmlClass, majorTickSize, minorTickSize);
    this.drawTickLabels('.' + htmlClass, tickLabelsVisible, labelTranslate);
  }

  drawTickLabels (htmlClass, isVisible, translatePosition) {
    // Tick label formatting
    var tickLabels = d3.selectAll(htmlClass + ' .tick text');

    // Main X and Y axes: remove minor tick labels
    if (isVisible) {
      tickLabels.attr('class', function (d, i) {
        if (i % 2 !== 0) d3.select(this).remove();
      });
    } else {
      // Secondary axes: remove all tick labels
      tickLabels.attr('class', function (d, i) {
        d3.select(this).remove();
      });
    }
    // Move printed labels away from the axis
    tickLabels.attr('transform', 'translate(' + translatePosition[0] + ',' + translatePosition[1] + ')');
  }

  drawTickLines (htmlClass, majorTickSize, minorTickSize) {
    var tickLines = d3.selectAll(htmlClass + ' .tick line');
    var tickCoordinate = this.getTickCoordinate();

    tickLines.attr(tickCoordinate, function (d, i) {
      return (i % 2 === 0) ? majorTickSize : minorTickSize;
    });
  }

  makeAxisFunc (scale, tickValues, tickFormat) {
    var axis;
    if (this.orientation === 'bottom') {
      axis = d3.axisBottom(scale)
        .tickSize(0, 0)
        .tickValues(tickValues)
        .tickFormat(tickFormat);
    } else if (this.orientation === 'top') {
      axis = d3.axisTop(scale)
        .tickSize(0, 0)
        .tickValues(tickValues)
        .tickFormat(tickFormat);
    } else if (this.orientation === 'left') {
      axis = d3.axisLeft(scale)
        .tickSize(0, 0)
        .tickValues(tickValues)
        .tickFormat(tickFormat);
    } else if (this.orientation === 'right') {
      axis = d3.axisRight(scale)
        .tickSize(0, 0)
        .tickValues(tickValues)
        .tickFormat(tickFormat);
    }
    return axis;
  }

  getTickCoordinate () {
    if (['left', 'right'].includes(this.orientation)) {
      return 'x2';
    } else if (['top', 'bottom'].includes(this.orientation)) {
      return 'y2';
    } else {
      throw Error('Axis orientation ' + this.orientation + ' not in [left, right, top, bottom].');
    }
  }

  getTickDirection () {
    if (['top', 'left'].includes(this.orientation)) {
      return 1;
    } else if (['bottom', 'right'].includes(this.orientation)) {
      return -1;
    } else {
      throw Error('Axis orientation ' + this.orientation + ' not in [left, right, top, bottom].');
    }
  }

  addMinorTicks (majorTicks, limits) {
    var tickSize = (majorTicks[1] - majorTicks[0]) / 2;
    var potentialFirstTick = majorTicks[0] - tickSize;
    var potentialLastTick = majorTicks[majorTicks.length - 1] + tickSize;
    var firstTick = (potentialFirstTick >= limits[0]) ? potentialFirstTick : majorTicks[0];
    var lastTick = (potentialLastTick <= limits[1]) ? potentialLastTick : majorTicks[majorTicks.length - 1];
    return d3.range(firstTick, lastTick + tickSize / 10, tickSize);
  }

  getTickFormat (ticks) {
    var orderOfMagn = orderOfMagnitude(ticks);
    var formatString = '.1e';
    if (ticks.every(numIsInteger)) {
      formatString = 'd';
    } else if (orderOfMagn < -2) {
      formatString = '.1e';
    } else if (orderOfMagn <= 0) {
      formatString = '.' + (Math.abs(orderOfMagn) + 2) + 'f';
    } else if (orderOfMagn < 4) {
      formatString = '.1f';
    }
    return d3.format(formatString);
  }
}

class Graph {
  constructor (x, y) {
    this.xyData = new XYData(x, y);
  }

  get graphMarginX () {
    return currentPlotStyle['graphMarginX'];
  }

  get graphMarginY () {
    return currentPlotStyle['graphMarginY'];
  }

  xLim () {
    return this.dataLim(this.xyData.xMin, this.xyData.xMax, this.xyData.xRange, this.graphMarginX);
  }

  yLim () {
    return this.dataLim(this.xyData.yMin, this.xyData.yMax, this.xyData.yRange, this.graphMarginY);
  }

  dataLim (min, max, range, margin) {
    return [min - range * margin, max + range * margin];
  }

  draw (axElem, xScale, yScale) {
    var dataPoints = this.xyData.makeLineData();
    var plotType = currentPlotStyle['plotType'];
    if (plotType === 'line') {
      var drawFunc = d3.line()
        .x(function (d) {
          return xScale(d.x_coord);
        })
        .y(function (d) {
          return yScale(d.y_coord);
        });
      // Add the plotted curve as path
      axElem.append('path')
        .attr('d', drawFunc(dataPoints))
        .attr('class', 'curve')
        .attr('fill', 'none')
        .attr('stroke', currentPlotStyle['dataColor'])
        .attr('clip-path', 'url(#clip_path)')
        .attr('stroke-width', toPercentWidth(currentPlotStyle['lineStrokeWidth']));
    } else if (plotType === 'scatter') {
      var scatterPlot = axElem.append('g')
        .attr('class', 'curve')
        .attr('id', 'scatterPlot')
        .attr('clip-path', 'url(#clip_path)');

      scatterPlot.selectAll('scatter-dots')
        .data(dataPoints)
        .enter().append('circle')
        .attr('class', 'scatter_dot')
        .attr('cx', function (d) {
          return xScale(d.x_coord);
        })
        .attr('cy', function (d) {
          return yScale(d.y_coord);
        })
        .attr('r', currentPlotStyle['scatterDotRadius'])
        .attr('fill', currentPlotStyle['dataColor']);
    }
  }
};

class XYData {
  constructor (x, y) {
    this.x = x;
    this.y = y;
  }

  nearestPoint (x0) {
    var pos = d3.bisectLeft(this.x, x0, 0, this.x.length);
    var prev = this.x[pos - 1];
    var next = this.x[pos];
    var idx = x0 - prev < next - x0 ? pos - 1 : pos;
    return {
      'x': this.x[idx],
      'y': this.y[idx]
    };
  }

  precisionX () {
    return formatPrecision(this.x[1] - this.x[0]);
  }

  precisionY () {
    return formatPrecision(this.y[1] - this.y[0]);
  }

  get xMin () {
    return d3.min(this.x);
  }

  get xMax () {
    return d3.max(this.x);
  }

  get xRange () {
    return getSpan(this.x);
  }

  get yMin () {
    return d3.min(this.y);
  }

  get yMax () {
    return d3.max(this.y);
  }

  get yRange () {
    return getSpan(this.y);
  }

  makeLineData () {
    var lineData = [];
    for (var i = 0; i < this.x.length; i++) {
      var point = {
        x_coord: this.x[i],
        y_coord: this.y[i]
      };
      lineData.push(point);
    }
    return lineData;
  }
};

function redraw () {
  plotXY(xyG);
}

function plotXY (xy) {
  if (!xy) {
    return;
  }

  updatePlotStyle();

  var x = xy[0].slice();
  var y = xy[1].slice();
  scaleArray(x, currentPlotStyle['xScaling']);
  scaleArray(y, currentPlotStyle['yScaling']);

  fig.reset();
  var ax = fig.addAxis();
  var graph = ax.plot(x, y);
  fig.draw();
  ax.addXLabel(document.getElementById('xLabel').value, fig.svgPercentageToPx(currentPlotStyle['xLabelFontSize']));
  ax.addYLabel(document.getElementById('yLabel').value, fig.svgPercentageToPx(currentPlotStyle['yLabelFontSize']));
  ax.addTitle(document.getElementById('title').value, fig.svgPercentageToPx(currentPlotStyle['titleFontSize']));
  document.querySelector('#toolbar').style.margin = '0  ' + fig.marginPercent.right * 100 + '% 0 ' + fig.marginPercent.left * 100 + '%';
}

function hideInstruction () {
  var instruction = document.getElementById('instruction_text');
  instruction.style.display = 'none';
  document.getElementById('figure_area').style.borderStyle = 'hidden';
}

function initSideBar () {
  populateSelectionBoxes();
  initDefaultValues();
  addSaveListeners();
  addRedrawListeners();
  addLabelListeners();
}

function addLabelListeners () {
  document.getElementById('xLabel').addEventListener('input', function (event) {
    fig.ax.addXLabel(document.getElementById('xLabel').value, fig.svgPercentageToPx(currentPlotStyle['xLabelFontSize']));
  });
  document.getElementById('yLabel').addEventListener('input', function (event) {
    fig.ax.addYLabel(document.getElementById('yLabel').value, fig.svgPercentageToPx(currentPlotStyle['yLabelFontSize']));
  });
  document.getElementById('title').addEventListener('input', function (event) {
    fig.ax.addTitle(document.getElementById('title').value, fig.svgPercentageToPx(currentPlotStyle['titleFontSize']));
  });
}

function addSaveListeners () {
  document.getElementById('svgButton').addEventListener('click', downloadSVG);
  document.getElementById('pngButton').addEventListener('click', downloadPNG);
}

function populateSelectionBoxes () {
  var fontSizesInt = d3.range(0.5, 4.5, 0.5);
  var fontSizesStr = appendStrtoArr(fontSizesInt, '%');

  var strokeWidthsInt = d3.range(1, 6, 1);
  var dotRadii = d3.range(1, 10, 0.5);

  populateSelectBox('xFontSize', fontSizesStr);
  populateSelectBox('yFontSize', fontSizesStr);
  populateSelectBox('titleFontSize', fontSizesStr);
  populateSelectBox('lineStrokeWidth', strokeWidthsInt);
  populateSelectBox('scatterDotRadius', dotRadii);
}

function initDefaultValues () {
  document.getElementById('xFontSize').value = defaultPlotStyle['xLabelFontSize'] + '%';
  document.getElementById('yFontSize').value = defaultPlotStyle['yLabelFontSize'] + '%';
  document.getElementById('titleFontSize').value = defaultPlotStyle['titleFontSize'] + '%';
  document.getElementById('xScaling').value = defaultPlotStyle['xScaling'];
  document.getElementById('yScaling').value = defaultPlotStyle['yScaling'];
  document.getElementById('lineStrokeWidth').value = defaultPlotStyle['lineStrokeWidth'];
  document.getElementById('scatterDotRadius').value = defaultPlotStyle['scatterDotRadius'];
  document.getElementById('plotType').value = defaultPlotStyle['plotType'];
  resetLimits();
}

function addRedrawListeners () {
  var params = ['xFontSize', 'yFontSize', 'titleFontSize',
    'xScaling', 'yScaling',
    'xStart', 'xEnd',
    'yStart', 'yEnd',
    'plotType', 'dataColor', 'lineStrokeWidth', 'scatterDotRadius'];
  for (var i = 0; i < params.length; i++) {
    var id = params[i];
    document.getElementById(id).addEventListener('change', function (event) { redraw(); });
  }

  window.addEventListener('resize', function (event) {
    redraw();
  });
}


function updatePlotStyle () {
  currentPlotStyle['xLabelFontSize'] = document.getElementById('xFontSize').value.replace('%', '');
  currentPlotStyle['yLabelFontSize'] = document.getElementById('yFontSize').value.replace('%', '');
  currentPlotStyle['titleFontSize'] = document.getElementById('titleFontSize').value.replace('%', '');

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

function initFigureArea () {
  document.getElementById('figure_area').addEventListener('paste', readPasteAndPlot);
}

class ToolbarFunctions {
  constructor (targetFigure) {
    this.fig = targetFigure;
    this.mouseArea = null;
  }

  clean () {
    d3.selectAll('.toolbar_addon').remove();
    d3.selectAll('.brush').remove();
    this.deactivateButtons();
  }

  deactivateButtons () {
    var buttonList = ['reset_button', 'zoom_button', 'pan_button', 'data_cursor_button'];
    for (var i = 0; i < buttonList.length; i++) {
      document.querySelector('#' + buttonList[i]).classList.remove('active');
    }
  }

  activateDataCursor () {
    this.clean();

    this.addMouseHandlerFunc(this.dataCursorFunc);
  }

  activateZoom () {
    this.clean();
    this.addMouseArea();
    this.zoomFunc();
  }

  addMouseArea () {
    this.mouseArea = this.fig.svgElement.append('rect')
      .attr('class', 'toolbar_addon')
      .attr('id', 'mouse_area')
      .attr('width', this.fig.axWidth())
      .attr('height', this.fig.axHeight())
      .attr('transform', 'translate(' + this.fig.axMargin().left + ',' + this.fig.axMargin().top + ')')
      .style('fill', 'transparent')
      .style('pointer-events', 'all');
  }

  addZoomArea () {
    this.brush = this.fig.svgElement.append('g')
      .attr('class', 'brush')
      .attr('width', this.fig.axWidth())
      .attr('height', this.fig.axHeight())
      .attr('transform', 'translate(' + this.fig.axMargin().left + ',' + this.fig.axMargin().top + ')')
      .style('fill', 'transparent');
  }

  addMouseHandlerFunc (func) {
    this.addMouseArea();
    this.mouseArea.on('mousemove', function (e) {
      const coordinates = d3.mouse(this);
      func(coordinates);
    });
  }

  dataCursorFunc (coordinates) {
    d3.select('.data_cursor').remove();
    var xExact = fig.ax.xScale.invert(coordinates[0]);
    var point = fig.ax.graph.xyData.nearestPoint(xExact);

    var cursor = fig.ax.axElem.append('g')
      .attr('class', 'data_cursor toolbar_addon');

    const cursorSize = 8;
    var cursorX = fig.ax.xScale(point.x) - cursorSize / 2;
    var cursorY = fig.ax.yScale(point.y) - cursorSize / 2;
    cursor.append('rect')
      .attr('width', cursorSize + 'px')
      .attr('height', cursorSize + 'px')
      .attr('fill', 'none')
      .attr('stroke-width', '2px')
      .attr('stroke', 'red')
      .attr('clip-path', 'url(#clip_path)')
      .attr('x', cursorX)
      .attr('y', cursorY);

    document.querySelector('#toolbar #x_coord').textContent = 'x = ' + point.x.toFixed(fig.ax.graph.xyData.precisionX());
    document.querySelector('#toolbar #y_coord').textContent = 'y = ' + point.y.toFixed(fig.ax.graph.xyData.precisionY());
  }

  zoomFunc () {
    toolbarFuncs.clean();
    toolbarFuncs.addZoomArea();
    zoomButton.classList.add('active');
    var brush = d3.brush()
      //.extent([[0, 0], [fig.ax.width, fig.ax.height]])
      .on('end', function () {
        const coord = d3.event.selection;
        if (!coord) {
          return;
        }
        var x = [coord[0][0], coord[1][0]];
        var y = [coord[0][1], coord[1][1]];

        var xMin = fig.ax.xScale.invert(Math.min(x[0], x[1]));
        var xMax = fig.ax.xScale.invert(Math.max(x[0], x[1]));

        var yMin = fig.ax.yScale.invert(Math.max(y[0], y[1])); // Image coords start at top.
        var yMax = fig.ax.yScale.invert(Math.min(y[0], y[1]));

        document.getElementById('xStart').value = xMin;
        document.getElementById('xEnd').value = xMax;

        document.getElementById('yStart').value = yMin;
        document.getElementById('yEnd').value = yMax;
        redraw();
        fig.svgElement.select('.brush').call(brush.move, null);
      });
    d3.select('.brush')
      .call(brush);
  }
}

function updateLimits (xStart, xEnd, yStart, yEnd) {
  document.getElementById('xStart').value = xStart;
  document.getElementById('xEnd').value = xEnd;
  document.getElementById('yStart').value = yStart;
  document.getElementById('yEnd').value = yEnd;
}

function resetLimits () {
  updateLimits(defaultPlotStyle['xStart'], defaultPlotStyle['xEnd'],
    defaultPlotStyle['yStart'], defaultPlotStyle['yEnd']);
}

var fig = new Figure('#figure_area');
var toolbarFuncs = new ToolbarFunctions(fig);

initSideBar();
initFigureArea();

var resetButton = document.querySelector('#reset_button');
resetButton.addEventListener('click', function (event) {
  toolbarFuncs.clean();
  resetLimits();
  redraw();
});

var dataCursorButton = document.querySelector('#data_cursor_button');
dataCursorButton.addEventListener('click', function (event) {
  if (dataCursorButton.classList.contains('active')) {
    toolbarFuncs.clean();
  } else {
    toolbarFuncs.activateDataCursor();
    dataCursorButton.classList.add('active');
  }
});

var zoomButton = document.querySelector('#zoom_button');
zoomButton.addEventListener('click', function (event) {
  if (zoomButton.classList.contains('active')) {
    toolbarFuncs.clean();
  } else {
    toolbarFuncs.zoomFunc();
  }
});

function panFunc () {
  function panDraw (x, y, k) {
    var xPan;
    var yPan;
    if (!panDraw.startX) {
      xPan = x;
      yPan = y;
    } else {
      xPan = x - panDraw.startX;
      yPan = y - panDraw.startY;
    }
    panDraw.startX = x;
    panDraw.startY = y;
    updateLimits(fig.ax.xLim()[0] - xPan * xDelta,
      fig.ax.xLim()[1] - xPan * xDelta,
      fig.ax.yLim()[0] - yPan * yDelta,
      fig.ax.yLim()[1] - yPan * yDelta);
    redraw();
  }

  panDraw.startX = undefined;
  panDraw.startY = undefined;

  var xDelta = fig.ax.xScale.invert(1) - fig.ax.xScale.invert(0);
  var yDelta = fig.ax.yScale.invert(1) - fig.ax.yScale.invert(0);

  toolbarFuncs.mouseArea.call(d3.zoom()
    .scaleExtent([1, 1])
    .on('zoom', function () {
      var transform = d3.zoomTransform(this);
      console.log(transform);
      var x = transform.x;
      var y = transform.y;
      var k = transform.k;
      panDraw(x, y, k);
    }));
}

var panButton = document.querySelector('#pan_button');
panButton.addEventListener('click', function (event) {
  if (panButton.classList.contains('active')) {
    toolbarFuncs.clean();
  } else {
    toolbarFuncs.clean();
    panButton.classList.add('active');
    toolbarFuncs.addMouseArea();
    panFunc();
  }
});
