/* global FileReader */
/* global Image */
/* global saveAs */
/* global XMLSerializer */
/* global d3 */

/*
var margin = {
  top: 60,
  right: 40,
  bottom: 100,
  left: 100
};
*/

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
  'graphMarginX': 0.0,
  'graphMarginY': 0.05
};

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
var axisFont = 'Sans-Serif';
var nTicks = 5;

class Figure {
  constructor () {
    this.ax = undefined;
    this.parentSelector = '#figure_area';
    this.selector = '#figure';
    this.marginPercent = {
      top: 0.05,
      bottom: 0.05,
      left: 0.08,
      right: 0.02
    };
  }

  get thisElement () {
    return document.querySelector(this.selector);
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
    var figureElem = d3.select(this.parentSelector)
      .append('svg')
      .attr('version', '1.1')
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('viewBox', '0 0 ' + this.width + ' ' + this.height)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('class', 'figure')
      .attr('id', 'figure');

    // Create an inner element to hold the axes
    var axElem = figureElem.append('g')
      .attr('transform', 'translate(' + this.axMargin().left + ',' + this.axMargin().top + ')')
      .attr('width', this.axWidth())
      .attr('height', this.axHeight())
      .attr('class', 'ax')
      .attr('id', 'ax');

    this.ax.draw(axElem);
  }

  reset () {
    if (this.thisElement) {
      d3.select('svg').remove();
    }
  }
};

class Axis {
  constructor (width, height, parentFig) {
    this.width = width;
    this.height = height;
    this.parentFig = parentFig;
    this.graph = undefined;
  }

  plot (x, y) {
    this.graph = new Graph(x, y);
    return this.graph;
  }

  draw (axElem) {
    console.log(this.xLim());
    var xScale = d3.scaleLinear()
      .domain(this.xLim())
      .range([0, this.width]);

    var yScale = d3.scaleLinear()
      .domain(this.yLim())
      .range([this.height, 0]);

    var xMajorTickValues = xScale.ticks(nTicks);
    var yMajorTickValues = yScale.ticks(nTicks);

    var xTickFormat = getTickFormat(xMajorTickValues);
    var yTickFormat = getTickFormat(yMajorTickValues);

    var xTickValues = addMinorTicks(xMajorTickValues, this.xLim());
    var yTickValues = addMinorTicks(yMajorTickValues, this.yLim());

    this.drawClipPath(axElem);
    console.log(xScale(this.graph.xyData.x));
    debugger;
    this.graph.draw(axElem, xScale, yScale);

    // Define axes
    var xAxis = d3.axisBottom(xScale)
      .tickSize(0, 0)
    // .ticks(nTicks)
      .tickValues(xTickValues)
      .tickFormat(xTickFormat);

    var yAxis = d3.axisLeft(yScale)
      .tickSize(0, 0)
    // .ticks(nTicks)
      .tickValues(yTickValues)
      .tickFormat(yTickFormat);

    var xAxisTop = d3.axisTop(xScale)
      .tickSize(0, 0)
      .tickValues(xTickValues);

    var yAxisRight = d3.axisRight(yScale)
      .tickSize(0, 0)
      .tickValues(yTickValues);

    // Add axes to the ax group
    axElem.append('g')
      .attr('transform', 'translate(0,' + this.height + ')')
      .attr('class', 'x_axis')
      .attr('stroke-width', currentPlotStyle['axisStrokeWidth'])
      .style('font-family', axisFont)
      .style('font-size', function (d) { return fig.svgPercentageToPx(currentPlotStyle['axisFontSize']); })
      .call(xAxis);

    axElem.append('g')
      .attr('transform', 'translate(0,0)')
      .attr('class', 'y_axis')
      .attr('stroke-width', currentPlotStyle['axisStrokeWidth'])
      .style('font-family', axisFont)
      .style('font-size', function (d) { return fig.svgPercentageToPx(currentPlotStyle['axisFontSize']); })
      .call(yAxis);

    axElem.append('g')
      .attr('transform', 'translate(0,0)')
      .attr('class', 'x_axis_top')
      .attr('stroke-width', currentPlotStyle['axisStrokeWidth'])
      .call(xAxisTop);

    axElem.append('g')
      .attr('transform', 'translate(' + this.width + ',0)')
      .attr('class', 'y_axis_right')
      .attr('stroke-width', currentPlotStyle['axisStrokeWidth'])
      .call(yAxisRight);

    // Major and minor tick line formatting
    var xTickLines = d3.selectAll('.x_axis .tick line');
    var xTickLinesTop = d3.selectAll('.x_axis_top .tick line');
    var yTickLines = d3.selectAll('.y_axis .tick line');
    var yTickLinesRight = d3.selectAll('.y_axis_right .tick line');

    var majorTickSize = this.parentFig.svgPercentageToPxInt(currentPlotStyle['majorTickSize']);
    var minorTickSize = this.parentFig.svgPercentageToPxInt(currentPlotStyle['minorTickSize']);

    xTickLines.attr('y2', function (d, i) {
      return (i % 2 === 0) ? -majorTickSize : -minorTickSize;
    });
    xTickLinesTop.attr('y2', function (d, i) {
      return (i % 2 === 0) ? majorTickSize : minorTickSize;
    });
    yTickLines.attr('x2', function (d, i) {
      return (i % 2 === 0) ? majorTickSize : minorTickSize;
    });
    yTickLinesRight.attr('x2', function (d, i) {
      return (i % 2 === 0) ? -majorTickSize : -minorTickSize;
    });

    // Tick label formatting
    var xTickLabels = d3.selectAll('.x_axis .tick text');
    var yTickLabels = d3.selectAll('.y_axis .tick text');
    var xTickLabelsTop = d3.selectAll('.x_axis_top .tick text');
    var yTickLabelsRight = d3.selectAll('.y_axis_right .tick text');

    // Main X and Y axes: remove minor tick labels
    xTickLabels.attr('class', function (d, i) {
      if (i % 2 !== 0) d3.select(this).remove();
    });
    yTickLabels.attr('class', function (d, i) {
      if (i % 2 !== 0) d3.select(this).remove();
    });

    // Secondary axes: remove all tick labels
    xTickLabelsTop.attr('class', function (d, i) {
      d3.select(this).remove();
    });
    yTickLabelsRight.attr('class', function (d, i) {
      d3.select(this).remove();
    });

    // Move printed labels away from the axis
    xTickLabels.attr('transform', 'translate(0,5)');
    yTickLabels.attr('transform', 'translate(-5,0)');
    this.addXLabel(document.getElementById('xLabel').value);
    this.addYLabel(document.getElementById('yLabel').value);
    this.addTitle(document.getElementById('title').value);
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

  addTitle (titleText) {
    var center = Math.floor(this.width / 2);
    var axis = d3.select('#ax');
    axis.selectAll('.title').remove();
    axis.append('text')
      .attr('class', 'title')
      .attr('text-anchor', 'middle')
      .attr('x', center)
      .attr('y', -this.parentFig.svgPercentageToPxInt(1))
      .attr('font-family', axisFont)
      .attr('font-size', function (d) { return fig.svgPercentageToPx(currentPlotStyle['titleFontSize']); })
      .text(titleText);
  }

  addXLabel (labelText) {
    var center = Math.floor(this.width / 2);
    var axis = d3.select('#ax');
    axis.selectAll('.x_label').remove();
    axis.append('text')
      .attr('class', 'x_label')
      .attr('text-anchor', 'middle')
      .attr('x', center)
      .attr('y', this.height + this.parentFig.svgPercentageToPxInt(4))
      .attr('font-family', axisFont)
      .attr('font-size', function (d) { return fig.svgPercentageToPx(currentPlotStyle['xLabelFontSize']); })
      .text(labelText);
  }

  addYLabel (labelText) {
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
      .attr('font-size', function (d) { return fig.svgPercentageToPx(currentPlotStyle['yLabelFontSize']); })
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
}

function hideInstruction () {
  var instruction = document.getElementById('instruction_text');
  instruction.style.visibility = 'hidden';
  document.getElementById('figure_area').style.borderStyle = 'hidden';
}

function addMinorTicks (majorTicks, limits) {
  var tickSize = (majorTicks[1] - majorTicks[0]) / 2;
  var potentialFirstTick = majorTicks[0] - tickSize;
  var potentialLastTick = majorTicks[majorTicks.length - 1] + tickSize;
  var firstTick = (potentialFirstTick >= limits[0]) ? potentialFirstTick : majorTicks[0];
  var lastTick = (potentialLastTick <= limits[1]) ? potentialLastTick : majorTicks[majorTicks.length - 1];
  return d3.range(firstTick, lastTick + tickSize / 10, tickSize);
}

function getTickFormat (ticks) {
  var orderOfMagn = Math.floor(Math.log10(Math.max(Math.abs(ticks[0]), Math.abs(ticks[ticks.length - 1]))));
  var formatString = '.1e';
  if (ticks.every(numIsInteger)) {
    formatString = 'd';
  } else if (orderOfMagn < -2) {
    formatString = '.1e';
  } else if (orderOfMagn <= 0) {
    formatString = '.' + (Math.abs(orderOfMagn) + 1) + 'f';
  } else if (orderOfMagn < 4) {
    formatString = '.1f';
  }
  return d3.format(formatString);
}

function initSideBar () {
  var fontSizesInt = d3.range(0.5, 4.5, 0.5);
  var fontSizesStr = appendStrtoArr(fontSizesInt, '%');

  var strokeWidthsInt = d3.range(1, 6, 1);
  var dotRadii = d3.range(1, 10, 0.5);

  populateSelectBox('xFontSize', fontSizesStr);
  populateSelectBox('yFontSize', fontSizesStr);
  populateSelectBox('titleFontSize', fontSizesStr);
  populateSelectBox('lineStrokeWidth', strokeWidthsInt);
  populateSelectBox('scatterDotRadius', dotRadii);

  document.getElementById('xFontSize').value = defaultPlotStyle['xLabelFontSize'] + '%';
  document.getElementById('yFontSize').value = defaultPlotStyle['yLabelFontSize'] + '%';
  document.getElementById('titleFontSize').value = defaultPlotStyle['titleFontSize'] + '%';
  document.getElementById('xScaling').value = defaultPlotStyle['xScaling'];
  document.getElementById('yScaling').value = defaultPlotStyle['yScaling'];
  document.getElementById('lineStrokeWidth').value = defaultPlotStyle['lineStrokeWidth'];
  document.getElementById('scatterDotRadius').value = defaultPlotStyle['scatterDotRadius'];

  resetLimits();

  document.getElementById('plotType').value = defaultPlotStyle['plotType'];

  document.getElementById('svgButton').addEventListener('click', downloadSVG);
  document.getElementById('pngButton').addEventListener('click', downloadPNG);

  document.getElementById('xFontSize').addEventListener('change', function (event) {
    redraw();
  });
  document.getElementById('yFontSize').addEventListener('change', function (event) {
    redraw();
  });
  document.getElementById('titleFontSize').addEventListener('change', function (event) {
    redraw();
  });

  document.getElementById('xScaling').addEventListener('change', function (event) {
    redraw();
  });
  document.getElementById('yScaling').addEventListener('change', function (event) {
    redraw();
  });

  document.getElementById('xStart').addEventListener('change', function (event) {
    redraw();
  });
  document.getElementById('xEnd').addEventListener('change', function (event) {
    redraw();
  });

  document.getElementById('yStart').addEventListener('change', function (event) {
    redraw();
  });
  document.getElementById('yEnd').addEventListener('change', function (event) {
    redraw();
  });

  document.getElementById('plotType').addEventListener('change', function (event) {
    redraw();
  });
  document.getElementById('dataColor').addEventListener('change', function (event) {
    redraw();
  });

  document.getElementById('lineStrokeWidth').addEventListener('change', function (event) {
    redraw();
  });
  document.getElementById('scatterDotRadius').addEventListener('change', function (event) {
    redraw();
  });

  document.getElementById('xLabel').addEventListener('input', function (event) {
    fig.ax.addXLabel(document.getElementById('xLabel').value);
  });
  document.getElementById('yLabel').addEventListener('input', function (event) {
    fig.ax.addYLabel(document.getElementById('yLabel').value);
  });
  document.getElementById('title').addEventListener('input', function (event) {
    fig.ax.addTitle(document.getElementById('title').value);
  });
}

function resetLimits () {
  document.getElementById('xStart').value = defaultPlotStyle['xStart'];
  document.getElementById('xEnd').value = defaultPlotStyle['xEnd'];
  document.getElementById('yStart').value = defaultPlotStyle['yStart'];
  document.getElementById('yEnd').value = defaultPlotStyle['yEnd'];
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

var fig = new Figure();
initSideBar();
document.getElementById('figure_area').addEventListener('paste', readPasteAndPlot);
window.addEventListener('resize', function (event) {
  redraw();
});
