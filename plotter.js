/* global FileReader */
/* global Image */
/* global saveAs */
/* global XMLSerializer */
/* global d3 */
/* global math */
/* global alert */

const defaultPlotStyle = {
  'majorTickSize': 0.6, // %
  'minorTickSize': 0.4, // %
  'axisStrokeWidth': 2.5, // %/10
  'axisFontSize': 1.25, // %
  'xLabelFontSize': 1.5,
  'yLabelFontSize': 1.5,
  'titleFontSize': 2, // %
  'xStart': 'auto',
  'xEnd': 'auto',
  'yStart': 'auto',
  'yEnd': 'auto',
  'majorGridOpacity': 0.6,
  'minorGridOpacity': 0.6,
  'majorGridStrokeWidth': 0.1,
  'minorGridStrokeWidth': 0.1,
  'majorGridColor': 'lightgray',
  'minorGridColor': 'lightgray',
  'graphMarginX': 0.05,
  'graphMarginY': 0.05,
  'horizontalGrid': false,
  'verticalGrid': false,
  'horizontalMinorGrid': false,
  'verticalMinorGrid': false,
  'legendLocation': 'none',
  'marginPercent': { top: 0.05, bottom: 0.08, left: 0.08, right: 0.02 }
};

const defaultTraceStyle = {
  'xScaling': 'x',
  'yScaling': 'y',
  'plotType': 'line',
  'markerSize': 10,
  'lineStrokeWidth': '1.5',
  'lineColor': 'black',
  'markerColor': '#ff0000',
  'lineStyle': 'solid',
  'markerStyle': 'Circle'
};

const kellyColorsAndBlack = [
  '#000000',
  '#C10020',
  '#FFB300',
  '#803E75',
  '#FF6800',
  '#A6BDD7',
  '#CEA262',
  '#817066',
  '#007D34',
  '#F6768E',
  '#00538A',
  '#FF7A5C',
  '#53377A',
  '#FF8E00',
  '#B32851',
  '#F4C800',
  '#7F180D',
  '#93AA00',
  '#593315',
  '#F13A13',
  '#232C16'
];

let currentPlotStyle = Object.assign({}, defaultPlotStyle);
let currentTraceStyle = Object.assign({}, defaultTraceStyle);

const canvasResFactor = 2;
const axisFont = 'Sans-Serif';
const nTicks = 5;
const fontSizesInt = d3.range(0.0, 3.6, 0.25);
const strokeWidthsInt = d3.range(0, 6.1, 0.5);
const markerSizes = d3.range(0, 21, 1);

class ColorGenerator {
  constructor () {
    this.idx = 0;
  }

  nextColor () {
    if (this.idx === kellyColorsAndBlack.length) {
      this.idx = 0;
    }
    var color = kellyColorsAndBlack[this.idx];
    this.idx++;
    return color;
  }
}

class Figure {
  constructor (parentSelector) {
    this.ax = undefined;
    this.parentSelector = parentSelector;
    this.selector = '#figure';
  }

  get svgElement () {
    if (document.querySelector(this.selector)) {
      return d3.select(this.selector);
    } else {
      return d3.select(this.parentSelector)
        .append('svg');
    }
  }

  get svgElementHtml () {
    return document.getElementById('figure');
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
    const diagonal = this.diagonal;
    return {
      top: Math.floor(currentPlotStyle.marginPercent.top * diagonal),
      bottom: Math.floor(currentPlotStyle.marginPercent.bottom * diagonal),
      left: Math.floor(currentPlotStyle.marginPercent.left * diagonal),
      right: Math.floor(currentPlotStyle.marginPercent.right * diagonal)
    };
  }

  axWidth () {
    return this.width - this.axMargin().left - this.axMargin().right;
  }

  axHeight () {
    return this.height - this.axMargin().top - this.axMargin().bottom;
  }

  addAxis () {
    this.ax = new Axis(this.axWidth(), this.axHeight(), this);
    return this.ax;
  }

  draw () {
    var svg = this.svgElement;
    svg.attr('version', '1.1')
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('viewBox', '0 0 ' + this.width + ' ' + this.height)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('class', 'figure')
      .attr('id', 'figure');
    this.ax.draw();
  }

  reset () {
    if (document.querySelector(this.selector)) {
      this.ax.remove();
    }
  }
}

class Axis {
  constructor (width, height, parentFig) {
    this.width = width;
    this.height = height;
    this.parentFig = parentFig;
    this.graphList = [];
    this.xScale = undefined;
    this.yScale = undefined;
  }

  plot (x, y, style) {
    let graph = new Graph(x, y);
    graph.setStyle(style);
    this.graphList.push(graph);
  }

  get activeGraph () {
    const graphIdx = Sidebar.traceList.activeGraphIdx();
    return this.graphList[graphIdx];
  }

  draw () {
    // Create an inner element to hold the axes
    this.dataAxElem = this.parentFig.svgElement.append('g')
      .attr('transform', 'translate(' + this.parentFig.axMargin().left + ',' + this.parentFig.axMargin().top + ')')
      .attr('width', this.parentFig.axWidth())
      .attr('height', this.parentFig.axHeight())
      .attr('class', 'ax')
      .attr('id', 'ax');

    this.helperAxElem = this.dataAxElem.append('g');

    this.xScale = d3.scaleLinear()
      .domain(this.xLim())
      .range([0, this.width]);

    this.yScale = d3.scaleLinear()
      .domain(this.yLim())
      .range([this.height, 0]);

    this.drawClipPath(this.dataAxElem);
    this.createAxes();
    this.drawGrids();
    this.drawAxes();
    var xScale = this.xScale;
    var yScale = this.yScale;
    var dataAxElem = this.dataAxElem;
    this.graphList.map(function (graph) { graph.draw(dataAxElem, xScale, yScale); });
  }

  remove () {
    this.dataAxElem.remove();
  }

  createAxes () {
    this.xAxis = this.createCoordAxis('bottom', [0, this.height], 'x_axis', true, [0, 5]);
    this.xAxisTop = this.createCoordAxis('top', [0, 0], 'x_axis_top', false, [0, 0]);
    this.yAxis = this.createCoordAxis('left', [0, 0], 'y_axis', true, [-5, 0]);
    this.yAxisRight = this.createCoordAxis('right', [this.width, 0], 'y_axis_right', false, [0, 0]);
    this.updateAxes();
  }

  updateAxes () {
    this.xScale.domain(this.xLim());
    this.yScale.domain(this.yLim());
    this.xAxis.update(this.xScale, this.xLim());
    this.xAxisTop.update(this.xScale, this.xLim());
    this.yAxis.update(this.yScale, this.yLim());
    this.yAxisRight.update(this.yScale, this.yLim());
  }

  drawAxes () {
    this.xAxis.draw(this.helperAxElem);
    this.xAxisTop.draw(this.helperAxElem);
    this.yAxis.draw(this.helperAxElem);
    this.yAxisRight.draw(this.helperAxElem);
  }

  removeAxesDrawings () {
    d3.select('.x_axis').remove();
    d3.select('.x_axis_top').remove();
    d3.select('.y_axis').remove();
    d3.select('.y_axis_right').remove();
    d3.selectAll('line.bottomGrid').remove();
    d3.selectAll('line.leftGrid').remove();
    d3.selectAll('line.bottomMinorGrid').remove();
    d3.selectAll('line.leftMinorGrid').remove();
  }

  drawGrids () {
    this.xAxis.drawMajorGrid(this.helperAxElem, currentPlotStyle['verticalGrid']);
    this.yAxis.drawMajorGrid(this.helperAxElem, currentPlotStyle['horizontalGrid']);
    this.xAxis.drawMinorGrid(this.helperAxElem, currentPlotStyle['verticalMinorGrid']);
    this.yAxis.drawMinorGrid(this.helperAxElem, currentPlotStyle['horizontalMinorGrid']);
  }

  createCoordAxis (orientation, translatePosition, htmlClass, tickLabelsVisible, labelTranslate) {
    var majorTickSize = this.parentFig.svgPercentageToPxInt(currentPlotStyle['majorTickSize']);
    var minorTickSize = this.parentFig.svgPercentageToPxInt(currentPlotStyle['minorTickSize']);
    var axisFontSize = this.parentFig.svgPercentageToPx(currentPlotStyle['axisFontSize']);
    return new CoordAxis(orientation, translatePosition,
      htmlClass, tickLabelsVisible, labelTranslate,
      majorTickSize, minorTickSize, axisFontSize);
  }

  drawClipPath () {
    this.dataAxElem.append('defs').append('clipPath')
      .attr('id', 'clip_path')
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', this.width)
      .attr('height', this.height);
  }

  addLegend (location) {
    if (location === 'none') {
      return;
    }

    const legendData = Sidebar.traceList.getLegendData();
    const labelOffsetX = 18;
    const labelOffsetY = 11;
    const deltaY = 20;
    const legendHeight = legendData.length * deltaY;
    const legendWidth = 130;

    let startX;
    let startY;

    if (location === 'northeast') {
      startX = fig.ax.width - legendWidth;
      startY = 15;
    } else if (location === 'southeast') {
      startX = fig.ax.width - legendWidth;
      startY = fig.ax.height - legendHeight - deltaY / 2;
    } else if (location === 'southwest') {
      startX = 15;
      startY = fig.ax.height - legendHeight - deltaY / 2;
    } else if (location === 'northwest') {
      startX = 15;
      startY = 15;
    }
    var legend = this.dataAxElem.append('g')
      .attr('class', 'legend')
      .attr('font-family', 'sans-serif')
      .selectAll('g')
      .data(legendData)
      .enter()
      .append('g')
      .attr('transform', function (d, i) {
        return 'translate(0,' + i * deltaY + ')';
      });

    legend.append('rect')
      .attr('x', startX)
      .attr('y', startY)
      .attr('height', 12)
      .attr('width', 12)
      .attr('fill', function (d) {
        return d.color;
      });

    legend.append('text')
      .attr('x', startX + labelOffsetX)
      .attr('y', startY + labelOffsetY)
      /* .attr('dy', '0.25em') */
      .text(function (d) {
        return d.name;
      });
  }

  addTitle (titleText, fontSize) {
    let center = Math.floor(this.width / 2);
    this.dataAxElem.selectAll('.title').remove();
    this.dataAxElem.append('text')
      .attr('class', 'title')
      .attr('text-anchor', 'middle')
      .attr('x', center)
      .attr('y', -this.parentFig.svgPercentageToPxInt(1))
      .attr('font-family', axisFont)
      .attr('font-size', fontSize)
      .html(titleText);
  }

  addXLabel (labelText, fontSize) {
    let center = Math.floor(this.width / 2);
    this.dataAxElem.selectAll('.x_label').remove();
    this.dataAxElem.append('text')
      .attr('class', 'x_label')
      .attr('text-anchor', 'middle')
      .attr('x', center)
      .attr('y', this.height + this.parentFig.svgPercentageToPxInt(4))
      .attr('dy', '0.35em')
      .attr('font-family', axisFont)
      .attr('font-size', fontSize)
      .html(labelText);
  }

  addYLabel (labelText, fontSize) {
    let center = Math.floor(this.height / 2);
    this.dataAxElem.selectAll('.y_label').remove();
    this.dataAxElem.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('class', 'y_label')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('y', -this.parentFig.svgPercentageToPxInt(6))
      .attr('x', -center)
      .attr('dy', '0.35em')
      .attr('font-family', axisFont)
      .attr('font-size', fontSize)
      .html(labelText);
  }

  xLim () {
    const userLimits = [currentPlotStyle['xStart'], currentPlotStyle['xEnd']];
    let dataLimitList = this.graphList.map(function (e) { return e.xLim(); });
    let dataLimits = this.dataLimitsFromList(dataLimitList);
    return this.getCoordinateLimits(dataLimits, userLimits);
  }

  yLim () {
    const userLimits = [currentPlotStyle['yStart'], currentPlotStyle['yEnd']];
    let dataLimitList = this.graphList.map(function (e) { return e.yLim(); });
    let dataLimits = this.dataLimitsFromList(dataLimitList);
    return this.getCoordinateLimits(dataLimits, userLimits);
  }

  dataLimitsFromList (dataLimitList) {
    let dataLimits = dataLimitList[0];
    for (let i = 1; i < dataLimitList.length; i++) {
      if (dataLimitList[i][0] < dataLimits[0]) {
        dataLimits[0] = dataLimitList[i][0];
      }
      if (dataLimitList[i][1] > dataLimits[1]) {
        dataLimits[1] = dataLimitList[i][1];
      }
    }
    return dataLimits;
  }

  getCoordinateLimits (dataLimits, userLimits) {
    var lim = dataLimits;
    if (userLimits[0] !== 'auto') {
      lim[0] = Util.toFloat(userLimits[0]);
    }
    if (userLimits[1] !== 'auto') {
      lim[1] = Util.toFloat(userLimits[1]);
    }
    return lim;
  }

  panTransform (transform) {
    for (var i = 0; i < this.graphList.length; i++) {
      this.graphList[i].panTransform(transform);
    }
  }
}

class CoordAxis {
  constructor (orientation, translatePosition,
    htmlClass, tickLabelsVisible, labelTranslate,
    majorTickSize, minorTickSize, axisFontSize) {
    this.orientation = orientation;
    this.translatePosition = translatePosition;
    this.htmlId = htmlClass;
    this.tickLabelsVisible = tickLabelsVisible;
    this.labelTranslate = labelTranslate;
    this.majorTickSize = majorTickSize * this.getTickDirection();
    this.minorTickSize = minorTickSize * this.getTickDirection();
    this.axisFontSize = axisFontSize;
    this.limits = undefined;
    this.scale = undefined;
    this.majorTickValues = undefined;
    this.minorTickValues = undefined;
  }

  update (scale, limits) {
    this.scale = scale;
    this.limits = limits;
    var suggestedTickValues = this.scale.ticks(nTicks);
    this.tickValues = this.addMinorTicks(suggestedTickValues, this.limits);
    this.majorTickValues = this.tickValues.filter(function (item, idx) {
      return idx % 2 === 0;
    });
    this.minorTickValues = this.tickValues.filter(function (item, idx) {
      return idx % 2 !== 0;
    });
  }

  draw (axElem) {
    var tickFormat = this.getTickFormat(this.majorTickValues);
    var axis = this.makeAxisFunc(this.scale, this.tickValues, tickFormat);

    // Add axes to the ax group
    axElem.append('g')
      .attr('transform', 'translate(' + this.translatePosition[0] + ',' + this.translatePosition[1] + ')')
      .attr('class', this.htmlId)
      .attr('stroke-width', fig.svgPercentageToPx(Util.toPercentWidth(currentPlotStyle['axisStrokeWidth'])))
      .style('font-family', axisFont)
      .style('font-size', this.axisFontSize)
      .call(axis);

    this.drawTickLines('.' + this.htmlId, this.majorTickSize, this.minorTickSize);
    this.drawTickLabels('.' + this.htmlId, this.tickLabelsVisible, this.labelTranslate);
  }

  drawMajorGrid (axElem, gridOn) {
    let gridClass = this.orientation + 'Grid';
    let strokeWidth = fig.svgPercentageToPx(currentPlotStyle['majorGridStrokeWidth']);
    let color = currentPlotStyle['majorGridColor'];
    let opacity = currentPlotStyle['majorGridOpacity'];
    this.drawGrid(axElem, gridClass, this.majorTickValues, gridOn, opacity, strokeWidth, color);
  }

  drawMinorGrid (axElem, gridOn) {
    let gridClass = this.orientation + 'MinorGrid';
    let strokeWidth = fig.svgPercentageToPx(currentPlotStyle['minorGridStrokeWidth']);
    let color = currentPlotStyle['minorGridColor'];
    let opacity = currentPlotStyle['minorGridOpacity'];
    this.drawGrid(axElem, gridClass, this.minorTickValues, gridOn, opacity, strokeWidth, color);
  }

  drawGrid (axElem, gridClass, tickValues, gridOn, opacity, strokeWidth, color) {
    if (!gridOn) {
      return;
    }
    let tickLongitudinalEnd = this.getTickCoordinate();
    let tickLongitudinalStart = this.getTickCoordinate().replace('2', '1');
    let gridStart = 0; // fig.axMargin()[this.orientation];
    let gridLength;
    let tickPosStart;
    let tickPosEnd;
    let tickPosScale;
    if (tickLongitudinalEnd === 'x2') {
      gridLength = fig.axWidth();
      tickPosStart = 'y1';
      tickPosEnd = 'y2';
      tickPosScale = fig.ax.yScale;
    } else {
      gridLength = fig.axHeight();
      tickPosStart = 'x1';
      tickPosEnd = 'x2';
      tickPosScale = fig.ax.xScale;
    }

    axElem.selectAll('line.' + gridClass).data(tickValues).enter()
      .append('line')
      .attr('class', gridClass)
      .attr(tickLongitudinalStart, gridStart)
      .attr(tickLongitudinalEnd, gridLength)
      .attr(tickPosStart, function (d) { return tickPosScale(d); })
      .attr(tickPosEnd, function (d) { return tickPosScale(d); })
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('opacity', opacity)
      .attr('stroke-width', strokeWidth);
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
    var orderOfMagn = Util.orderOfMagnitude(ticks);
    var formatString = '.1~e';
    if (ticks.every(Util.numIsInteger)) {
      formatString = '.1~f';
    } else if (orderOfMagn < -2) {
      formatString = '.1~e';
    } else if (orderOfMagn <= 0) {
      formatString = '.' + (Math.abs(orderOfMagn) + 2) + '~f';
    } else if (orderOfMagn < 4) {
      formatString = '.1~f';
    }
    return d3.format(formatString);
  }
}

class Graph {
  constructor (x, y) {
    this.xyData = new XYData(x, y);
  }

  setStyle (style) {
    this.style = style;
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
    var plotType = this.style.plotType;
    this.clipGroup = axElem.append('g')
      .attr('clip-path', 'url(#clip_path)');
    this.plotGroup = this.clipGroup.append('g');
    if (plotType === 'line') {
      this.drawLine(dataPoints, xScale, yScale);
    } else if (plotType === 'scatter') {
      this.drawScatter(dataPoints, xScale, yScale);
    } else if (plotType === 'line + scatter') {
      this.drawLine(dataPoints, xScale, yScale);
      this.drawScatter(dataPoints, xScale, yScale);
    }
  }

  drawLine (dataPoints, xScale, yScale) {
    var drawFunc = d3.line()
      .x(function (d) {
        return xScale(d.x);
      })
      .y(function (d) {
        return yScale(d.y);
      });

    var dashArray = ('1, 0');
    if (this.style.lineStyle === 'solid') {
      dashArray = ('1, 0');
    } else if (this.style.lineStyle === 'dashed') {
      dashArray = ('12, 4');
    }
    this.plotGroup.append('path')
      .attr('d', drawFunc(dataPoints))
      .attr('class', 'curve')
      .attr('fill', 'none')
      .attr('stroke', this.style.lineColor)
      .attr('stroke-dasharray', dashArray)
      .attr('stroke-width', fig.svgPercentageToPx(Util.toPercentWidth(this.style.lineStrokeWidth)));
  }

  drawScatter (dataPoints, xScale, yScale) {
    var scatterPlot = this.plotGroup.append('g')
      .attr('class', 'curve')
      .attr('id', 'scatterPlot');

    let symbolType = 'symbol' + this.style.markerStyle;
    let symbolSize = this.style.markerSize ** 2;
    let symbol = d3.symbol();
    scatterPlot.selectAll('.point')
      .data(dataPoints)
      .enter().append('path')
      .attr('class', 'point')
      .attr('d', symbol.size(symbolSize).type(function (d) {
        return d3[symbolType];
      }))
      .attr('transform', function (d) {
        return 'translate(' + xScale(d.x) + ',' + yScale(d.y) + ')';
      })
      .attr('fill', this.style.markerColor);
  }

  panTransform (transform) {
    if (this.plotGroup) {
      this.plotGroup.attr('transform', transform);
    }
  }
}

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
    return Util.formatPrecision(this.x[1] - this.x[0]);
  }

  precisionY () {
    return Util.formatPrecision(this.y[1] - this.y[0]);
  }

  get xMin () {
    return d3.min(this.x);
  }

  get xMax () {
    return d3.max(this.x);
  }

  get xRange () {
    return Util.getSpan(this.x);
  }

  get yMin () {
    return d3.min(this.y);
  }

  get yMax () {
    return d3.max(this.y);
  }

  get yRange () {
    return Util.getSpan(this.y);
  }

  makeLineData () {
    var lineData = [];
    for (var i = 0; i < this.x.length; i++) {
      var point = {
        x: this.x[i],
        y: this.y[i]
      };
      lineData.push(point);
    }
    return lineData;
  }
}

class Trace {
  constructor (xy, style, name) {
    this.x = xy[0];
    this.y = xy[1];
    this.style = style;
    this.name = name;
    this.isVisible = true;
  }

  get legendColor () {
    if (this.style.plotType === 'scatter') {
      return this.style.markerColor;
    }
    return this.style.lineColor;
  }

  get xTransformed () {
    let x = this.x.slice();
    try {
      x = Util.transformData(x, 'x', this.style.xScaling);
    } catch (exception) {
      console.error(exception);
      alert('Function not recognized!');
    }
    return x;
  }

  get yTransformed () {
    let y = this.y.slice();
    try {
      y = Util.transformData(y, 'y', this.style.yScaling);
    } catch (exception) {
      console.error(exception);
      alert('Function not recognized!');
    }
    return y;
  }
}

class TraceList {
  constructor () {
    this.id = 'traceTable';
    this.traces = [];
    this.activeTraceIdx = -1;
    this.colorGenerator = new ColorGenerator();
  }

  get htmlTableBody () {
    return document.getElementById(this.id).getElementsByTagName('tbody')[0];
  }

  newTraceName (userTraceName) {
    if (userTraceName === 'pasted_data') {
      return 'Trace ' + (this.traces.length + 1);
    } else {
      return userTraceName;
    }
  }

  get activeTrace () {
    return this.traces[this.activeTraceIdx];
  }

  activeGraphIdx () {
    var graphIdx = this.activeTraceIdx;
    for (var i = 0; i < this.activeTraceIdx; i++) {
      if (!Sidebar.traceList.traces[i].isVisible) {
        graphIdx--;
      }
    }
    return graphIdx;
  }

  get visibleTraces () {
    return this.traces.filter(t => t.isVisible);
  }

  getLegendData () {
    this.updateTraceLabels();
    let legendData = [];
    for (var i = 0; i < this.traces.length; i++) {
      var trace = this.traces[i];
      if (trace.isVisible) {
        legendData.push({
          'name': trace.name,
          'color': trace.legendColor
        });
      }
    }
    return legendData;
  }

  updateActiveTraceStyle (newStyle) {
    this.activeTrace.style = newStyle;
    this.updateActiveTraceColorSquare();
  }

  updateTraceLabels () {
    for (var i = 0; i < this.traces.length; i++) {
      this.traces[i].name = this.htmlTableBody.rows[i + 1].querySelector('input').value;
    }
  }

  activateTrace (listIdx) {
    if (this.activeTraceIdx >= 0) {
      this.deactivateRow(this.activeTraceIdx + 1);
    }
    this.activeTraceIdx = listIdx;
    this.activateRow(this.activeTraceIdx + 1);
  }

  deactivateRow (idx) {
    this.htmlTableBody.rows[idx].classList.remove('active');
  }

  activateRow (idx) {
    this.htmlTableBody.rows[idx].classList.add('active');
  }

  updateActiveTraceColorSquare () {
    let colorSquare = this.htmlTableBody.querySelector('.active .color_square');
    colorSquare.style.backgroundColor = this.activeTrace.legendColor;
  }

  addTrace (xy, traceName) {
    var style = Object.assign({}, currentTraceStyle);
    this.colorGenerator.idx = this.traces.length;
    var color = this.colorGenerator.nextColor();
    style.markerColor = color;
    style.lineColor = color;
    var label = this.newTraceName(traceName);
    var newTrace = new Trace(xy, style, label);
    this.traces.push(newTrace);
    currentTraceStyle = Object.assign({}, style);
    this.addTableRow(newTrace.name, newTrace.legendColor);
    this.activateTrace(this.traces.length - 1);
    Sidebar.showCurrentTraceStyle();
  }

  deleteTrace (listIdx) {
    if (listIdx <= this.activeTraceIdx) {
      this.activeTraceIdx = this.traces.length - 2;
    }
    this.traces.splice(listIdx, 1);
    this.deleteTableRow(listIdx + 1);
  }

  addTableRow (label, color) {
    let tableBody = this.htmlTableBody;
    var addedRow = tableBody.insertRow(tableBody.rows.length);
    var textCell = addedRow.insertCell(0);
    var buttonCell = addedRow.insertCell(1);

    textCell.classList.add('text_cell');
    buttonCell.classList.add('button_cell');

    // https://stackoverflow.com/questions/45656949/how-to-return-the-row-and-column-index-of-a-table-cell-by-clicking
    addedRow.addEventListener('dblclick', function (e) {
      const rowList = Array.from(tableBody.rows);
      const rowIdx = rowList.findIndex(row => row.contains(e.target));
      Sidebar.activateTrace(rowIdx - 1);
    });

    var colorSquare = document.createElement('div');
    colorSquare.classList.add('color_square');
    colorSquare.style.backgroundColor = color;

    var txt = document.createElement('input');
    txt.type = 'text';
    txt.value = label;
    txt.contentEditable = true;
    txt.addEventListener('change', function (event) { FigureArea.redraw(); });

    var showHideButton = document.createElement('button');
    showHideButton.classList.add('trace_button');
    showHideButton.textContent = 'Hide';
    showHideButton.addEventListener('click', function (e) {
      showHideButton.textContent = showHideButton.textContent === 'Hide' ? 'Show' : 'Hide';
      const rowList = Array.from(tableBody.rows);
      const rowIdx = rowList.findIndex(row => row.contains(e.target));
      Sidebar.toggleTraceVisibility(rowIdx - 1);
    });
    var clearButton = document.createElement('button');
    clearButton.classList.add('trace_button');
    clearButton.textContent = 'Clear';
    clearButton.addEventListener('click', function (e) {
      const rowList = Array.from(tableBody.rows);
      const rowIdx = rowList.findIndex(row => row.contains(e.target));
      Sidebar.deleteTrace(rowIdx - 1);
    });

    textCell.appendChild(colorSquare);
    textCell.appendChild(txt);
    buttonCell.appendChild(showHideButton);
    buttonCell.appendChild(clearButton);
    Util.resetPosition(txt);
  }

  deleteTableRow (rowIdx) {
    this.htmlTableBody.deleteRow(rowIdx);
  }
}

class FigureArea {
  static initialize () {
    document.getElementById('figure_area').addEventListener('paste', FigureArea.readPasteAndPlot);
    document.getElementById('figure_area').addEventListener('drop', FigureArea.dropHandler);
    document.getElementById('figure_area').addEventListener('dragover', FigureArea.dragOverHandler);
    window.addEventListener('resize', function (event) {
      FigureArea.redraw();
    });
  }

  // https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop
  static dropHandler (ev) {
    ev.preventDefault();
    if (ev.dataTransfer.items) {
      for (var i = 0; i < ev.dataTransfer.items.length; i++) {
        if (ev.dataTransfer.items[i].kind === 'file') {
          var file = ev.dataTransfer.items[i].getAsFile();
          FigureArea.fileHandler(file);
        }
      }
    }
    FigureArea.removeDragData(ev);
  }

  static dragOverHandler (ev) {
    ev.stopPropagation();
    ev.preventDefault();
  }

  static removeDragData (ev) {
    if (ev.dataTransfer.items) {
      ev.dataTransfer.items.clear();
    } else {
      ev.dataTransfer.clearData();
    }
  }

  // https://www.html5rocks.com/en/tutorials/file/dndfiles/
  static fileHandler (file) {
    var reader = new FileReader();
    reader.onload = (function (dataFile) {
      return function (e) {
        FigureArea.parseAndPlot(e.target.result, file.name);
      };
    })();
    reader.readAsText(file);
  }

  // https://stackoverflow.com/questions/2176861/javascript-get-clipboard-data-on-paste-event-cross-browser
  static readPasteAndPlot (e) {
    var clipboardData, pastedData;
    var fileName = 'pasted_data';

    e.stopPropagation();
    e.preventDefault();

    clipboardData = e.clipboardData || window.clipboardData;
    pastedData = clipboardData.getData('Text');
    FigureArea.parseAndPlot(pastedData, fileName);
  }

  static parseAndPlot (str, fileName) {
    var xy = Util.regexParse(str);
    if (xy[0].length < 2) {
      alert('Input data could not be parsed! Please use two columns separated by tab, comma, semicolon and/or spaces.');
      return;
    }
    FigureArea.fileName = Util.stripFileExtension(fileName);
    Sidebar.traceList.addTrace(xy, FigureArea.fileName);
    Sidebar.resetLimits();
    FigureArea.redraw();
    FigureArea.hideInstruction();
    Toolbar.show();
    Sidebar.show();
  }

  static hideInstruction () {
    document.getElementById('instruction_text').style.display = 'none';
    document.getElementById('figure_area').style.borderStyle = 'hidden';
  }

  static redraw () {
    fig.reset();
    Sidebar.updatePlotStyle();
    var ax = fig.addAxis();
    var traces = Sidebar.traceList.visibleTraces;

    for (var i = 0; i < traces.length; i++) {
      let trace = traces[i];
      let x = trace.xTransformed;
      let y = trace.yTransformed;
      let style = trace.style;
      ax.plot(x, y, style);
    }

    fig.draw();
    ax.addXLabel(Sidebar.xLabel, fig.svgPercentageToPx(currentPlotStyle['xLabelFontSize']));
    ax.addYLabel(Sidebar.yLabel, fig.svgPercentageToPx(currentPlotStyle['yLabelFontSize']));
    ax.addTitle(Sidebar.title, fig.svgPercentageToPx(currentPlotStyle['titleFontSize']));
    ax.addLegend(currentPlotStyle.legendLocation, fig.svgPercentageToPx(currentPlotStyle.axisFontSize));
    Toolbar.applyMargin();
    Toolbar.reactivateButton();
  }
}

class Sidebar {
  static initialize () {
    Sidebar.populateSelectionBoxes();
    Sidebar.initDefaultValues();
    Sidebar.addRedrawListeners();
    Sidebar.addLabelListeners();
    Sidebar.addTooltipListeners();
    Sidebar.hide();
    Sidebar.traceList = new TraceList();
  }

  static show () {
    document.getElementById('sidebar').style.display = 'block';
  }

  static hide () {
    document.getElementById('sidebar').style.display = 'none';
  }

  static addLabelListeners () {
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

  static populateSelectionBoxes () {
    var fontSizesStr = Util.appendStrtoArr(fontSizesInt, '%');
    Util.populateSelectBox('xFontSize', fontSizesStr);
    Util.populateSelectBox('yFontSize', fontSizesStr);
    Util.populateSelectBox('titleFontSize', fontSizesStr);
    Util.populateSelectBox('axisFontSize', fontSizesStr);
    Util.populateSelectBox('lineStrokeWidth', strokeWidthsInt);
    Util.populateSelectBox('axisStrokeWidth', strokeWidthsInt);
    Util.populateSelectBox('markerSize', markerSizes);
  }

  static initDefaultValues () {
    document.getElementById('xFontSize').value = defaultPlotStyle['xLabelFontSize'] + '%';
    document.getElementById('yFontSize').value = defaultPlotStyle['yLabelFontSize'] + '%';
    document.getElementById('titleFontSize').value = defaultPlotStyle['titleFontSize'] + '%';
    document.getElementById('axisFontSize').value = defaultPlotStyle['axisFontSize'] + '%';
    document.getElementById('axisStrokeWidth').value = defaultPlotStyle['axisStrokeWidth'];

    document.getElementById('xScaling').value = defaultTraceStyle['xScaling'];
    document.getElementById('yScaling').value = defaultTraceStyle['yScaling'];
    document.getElementById('lineStrokeWidth').value = defaultTraceStyle['lineStrokeWidth'];
    document.getElementById('markerSize').value = defaultTraceStyle['markerSize'];
    document.getElementById('plotType').value = defaultTraceStyle['plotType'];
    Sidebar.resetLimits();
  }

  static updateLimits (xStart, xEnd, yStart, yEnd) {
    document.getElementById('xStart').value = xStart;
    document.getElementById('xEnd').value = xEnd;
    document.getElementById('yStart').value = yStart;
    document.getElementById('yEnd').value = yEnd;
  }

  static resetLimits () {
    Sidebar.updateLimits(defaultPlotStyle['xStart'], defaultPlotStyle['xEnd'],
      defaultPlotStyle['yStart'], defaultPlotStyle['yEnd']);
  }

  static addRedrawListeners () {
    var params = ['xFontSize', 'yFontSize', 'titleFontSize',
      'xStart', 'xEnd',
      'yStart', 'yEnd',
      'plotType',
      'lineColor', 'markerColor',
      'lineStyle', 'markerStyle',
      'lineStrokeWidth', 'markerSize',
      'axisStrokeWidth', 'axisFontSize',
      'horizontalGrid', 'verticalGrid',
      'horizontalMinorGrid', 'verticalMinorGrid',
      'legendLocation'];
    for (let i = 0; i < params.length; i++) {
      let id = params[i];
      let elem = document.getElementById(id);
      elem.addEventListener('change', function (event) {
        FigureArea.redraw();
      });
    }

    var rescaleParams = ['xScaling', 'yScaling'];
    for (let i = 0; i < rescaleParams.length; i++) {
      let id = rescaleParams[i];
      let elem = document.getElementById(id);
      elem.addEventListener('change', function (event) {
        Sidebar.resetLimits();
        FigureArea.redraw();
      });
    }
  }

  static hideTooltips () {
    var tooltips = document.querySelectorAll('.tooltip-wrapper');
    for (var i = 0; i < tooltips.length; i++) {
      tooltips[i].style.display = 'none';
    }
  }

  static addTooltipListeners () {
    var params = ['title', 'xLabel', 'yLabel', 'xFontSize', 'yFontSize', 'titleFontSize',
      'xStart', 'xEnd',
      'yStart', 'yEnd',
      'xScaling', 'yScaling',
      'plotType',
      'lineColor', 'markerColor',
      'lineStyle', 'markerStyle',
      'lineStrokeWidth', 'markerSize',
      'axisStrokeWidth', 'axisFontSize',
      'horizontalGrid', 'verticalGrid',
      'horizontalMinorGrid', 'verticalMinorGrid',
      'legendLocation', 'traceTable'];
    for (let i = 0; i < params.length; i++) {
      let id = params[i];
      let elem = document.getElementById(id);
      let parent = elem.closest('.has-tooltip');
      let input = parent.querySelector('select, input');
      let tooltip = parent.querySelector('.tooltip-wrapper');
      parent.addEventListener('mouseover', function (event) {
        tooltip.style.display = 'block';
        tooltip.style.top = Sidebar.getTooltipPositionPx(elem);
        if (input != null) { // null check for traceTable -> consider refactoring
          input.classList.add('active');
        }
      });
      parent.addEventListener('mouseout', function (event) {
        tooltip.style.display = 'none';
        if (input != null) { // null check for traceTable -> consider refactoring
          input.classList.remove('active');
        }
      });
    }
  }

  static getTooltipPositionPx (element) {
    let viewportOffset = element.getBoundingClientRect();
    let top = viewportOffset.top;
    return top - 30 + 'px';
  }

  static updatePlotStyle () {
    currentPlotStyle['xLabelFontSize'] = Sidebar.xLabelFontSize;
    currentPlotStyle['yLabelFontSize'] = Sidebar.yLabelFontSize;
    currentPlotStyle['titleFontSize'] = Sidebar.titleFontSize;
    currentPlotStyle['xStart'] = Sidebar.xStart;
    currentPlotStyle['xEnd'] = Sidebar.xEnd;
    currentPlotStyle['yStart'] = Sidebar.yStart;
    currentPlotStyle['yEnd'] = Sidebar.yEnd;
    currentPlotStyle['axisStrokeWidth'] = Sidebar.axisStrokeWidth;
    currentPlotStyle['axisFontSize'] = Sidebar.axisFontSize;
    currentPlotStyle['horizontalGrid'] = Sidebar.horizontalGrid;
    currentPlotStyle['verticalGrid'] = Sidebar.verticalGrid;
    currentPlotStyle['horizontalMinorGrid'] = Sidebar.horizontalMinorGrid;
    currentPlotStyle['verticalMinorGrid'] = Sidebar.verticalMinorGrid;
    currentPlotStyle['activeTrace'] = Sidebar.activeTrace;
    currentPlotStyle['legendLocation'] = Sidebar.legendLocation;

    currentTraceStyle['xScaling'] = Sidebar.xScaling;
    currentTraceStyle['yScaling'] = Sidebar.yScaling;
    currentTraceStyle['plotType'] = Sidebar.plotType;
    currentTraceStyle['lineColor'] = Sidebar.lineColor;
    currentTraceStyle['markerColor'] = Sidebar.markerColor;
    currentTraceStyle['lineStyle'] = Sidebar.lineStyle;
    currentTraceStyle['markerStyle'] = Sidebar.markerStyle;
    currentTraceStyle['lineStrokeWidth'] = Sidebar.lineStrokeWidth;
    currentTraceStyle['markerSize'] = Sidebar.markerSize;
    Sidebar.traceList.updateActiveTraceStyle(Object.assign({}, currentTraceStyle));
    Sidebar.traceList.updateTraceLabels();
  }

  static activateTrace (idx) {
    Sidebar.traceList.activateTrace(idx);
    currentTraceStyle = Sidebar.traceList.activeTrace.style;
    Sidebar.showCurrentTraceStyle();
  }

  static deleteTrace (idx) {
    Sidebar.traceList.deleteTrace(idx);
    if (Sidebar.traceList.activeTraceIdx >= 0) {
      Sidebar.activateTrace(Sidebar.traceList.activeTraceIdx);
    }
    if (Sidebar.traceList.traces.length === 0) {
      Sidebar.hide();
      Toolbar.hide();
    }
    Sidebar.hideTooltips();
    FigureArea.redraw();
  }

  static toggleTraceVisibility (idx) {
    Sidebar.traceList.traces[idx].isVisible = !Sidebar.traceList.traces[idx].isVisible;
    FigureArea.redraw();
  }

  static showCurrentTraceStyle () {
    document.getElementById('xScaling').value = currentTraceStyle.xScaling;
    document.getElementById('yScaling').value = currentTraceStyle.yScaling;
    document.getElementById('plotType').value = currentTraceStyle.plotType;
    document.getElementById('lineColor').value = currentTraceStyle.lineColor;
    document.getElementById('markerColor').value = currentTraceStyle.markerColor;
    document.getElementById('lineStyle').value = currentTraceStyle.lineStyle;
    document.getElementById('markerStyle').value = currentTraceStyle.markerStyle;
    document.getElementById('lineStrokeWidth').value = currentTraceStyle.lineStrokeWidth;
    document.getElementById('markerSize').value = currentTraceStyle.markerSize;
  }

  static get title () {
    return document.getElementById('xLabel').value;
  }

  static get xLabel () {
    return document.getElementById('xLabel').value;
  }

  static get yLabel () {
    return document.getElementById('xLabel').value;
  }

  static get xLabelFontSize () {
    return document.getElementById('xFontSize').value.replace('%', '');
  }

  static get yLabelFontSize () {
    return document.getElementById('yFontSize').value.replace('%', '');
  }

  static get titleFontSize () {
    return document.getElementById('titleFontSize').value.replace('%', '');
  }

  static get xScaling () {
    return document.getElementById('xScaling').value;
  }

  static get yScaling () {
    return document.getElementById('yScaling').value;
  }

  static get xStart () {
    return document.getElementById('xStart').value;
  }

  static get xEnd () {
    return document.getElementById('xEnd').value;
  }

  static get yStart () {
    return document.getElementById('yStart').value;
  }

  static get yEnd () {
    return document.getElementById('yEnd').value;
  }

  static get plotType () {
    return document.getElementById('plotType').value;
  }

  static get lineColor () {
    return document.getElementById('lineColor').value;
  }

  static get markerColor () {
    return document.getElementById('markerColor').value;
  }

  static get lineStyle () {
    return document.getElementById('lineStyle').value;
  }

  static get markerStyle () {
    return document.getElementById('markerStyle').value;
  }

  static get lineStrokeWidth () {
    return document.getElementById('lineStrokeWidth').value;
  }

  static get markerSize () {
    return document.getElementById('markerSize').value;
  }

  static get axisStrokeWidth () {
    return document.getElementById('axisStrokeWidth').value;
  }

  static get axisFontSize () {
    return document.getElementById('axisFontSize').value.replace('%', '');
  }

  static get horizontalGrid () {
    return document.getElementById('horizontalGrid').checked;
  }

  static get verticalGrid () {
    return document.getElementById('verticalGrid').checked;
  }

  static get horizontalMinorGrid () {
    return document.getElementById('horizontalMinorGrid').checked;
  }

  static get verticalMinorGrid () {
    return document.getElementById('verticalMinorGrid').checked;
  }

  static get legendLocation () {
    return document.getElementById('legendLocation').value;
  }
}

class Toolbar {
  static initialize () {
    Toolbar.buttonList = ['reset_button', 'zoom_button', 'pan_button', 'data_cursor_button'];
    Toolbar.mouseArea = null;
    Toolbar.addSaveListeners();
    Toolbar.initResetButton();
    Toolbar.initDataCursorButton();
    Toolbar.initZoomButton();
    Toolbar.initPanButton();
  }

  static show () {
    document.getElementById('toolbar').style.display = 'block';
  }

  static hide () {
    document.getElementById('toolbar').style.display = 'none';
  }

  static applyMargin () {
    document.querySelector('#toolbar').style.margin = '0  ' + currentPlotStyle.marginPercent.right * 100 + '% 0 ' + currentPlotStyle.marginPercent.left * 100 + '%';
  }

  static get resetButton () {
    return document.querySelector('#reset_button');
  }

  static get dataCursorButton () {
    return document.querySelector('#data_cursor_button');
  }

  static get zoomButton () {
    return document.querySelector('#zoom_button');
  }

  static get panButton () {
    return document.querySelector('#pan_button');
  }

  static addSaveListeners () {
    document.getElementById('svgButton').addEventListener('click', function () {
      ImageExport.downloadSVG(fig, FigureArea.fileName);
    });
    document.getElementById('pngButton').addEventListener('click', function () {
      ImageExport.downloadPNG(fig, FigureArea.fileName);
    });
  }

  static initResetButton () {
    Toolbar.resetButton.addEventListener('click', function (event) {
      Sidebar.resetLimits();
      FigureArea.redraw();
    });
  }

  static initDataCursorButton () {
    Toolbar.dataCursorButton.addEventListener('click', Toolbar.dataCursorButtonOnClick);
  }

  static dataCursorButtonOnClick () {
    if (Toolbar.dataCursorButton.classList.contains('active')) {
      Toolbar.clean();
    } else {
      Toolbar.activateDataCursor();
      Toolbar.dataCursorButton.classList.add('active');
    }
  }

  static initZoomButton () {
    Toolbar.zoomButton.addEventListener('click', Toolbar.zoomButtonOnClick);
  }

  static zoomButtonOnClick () {
    if (Toolbar.zoomButton.classList.contains('active')) {
      Toolbar.clean();
    } else {
      Toolbar.zoomFunc();
    }
  }

  static initPanButton () {
    Toolbar.panButton.addEventListener('click', Toolbar.panButtonOnClick);
  }

  static panButtonOnClick () {
    if (Toolbar.panButton.classList.contains('active')) {
      Toolbar.clean();
    } else {
      Toolbar.clean();
      Toolbar.panButton.classList.add('active');
      Toolbar.addMouseArea();
      Toolbar.panFunc();
    }
  }

  static clean () {
    d3.selectAll('.toolbar_addon').remove();
    d3.selectAll('.brush').remove();
    Toolbar.deactivateButtons();
  }

  static deactivateButtons () {
    for (var i = 0; i < Toolbar.buttonList.length; i++) {
      document.querySelector('#' + Toolbar.buttonList[i]).classList.remove('active');
    }
  }

  static reactivateButton () {
    var activeButton = document.querySelector('#toolbar .active');
    if (!activeButton) {
      return;
    }
    Toolbar.deactivateButtons();
    if (activeButton.id === 'pan_button') {
      Toolbar.panButtonOnClick();
    } else if (activeButton.id === 'zoom_button') {
      Toolbar.zoomButtonOnClick();
    } else if (activeButton.id === 'data_cursor_button') {
      Toolbar.dataCursorButtonOnClick();
    }
  }

  static activateDataCursor () {
    Toolbar.clean();
    Toolbar.addMouseHandlerFunc(Toolbar.dataCursorFunc);
  }

  static addMouseArea () {
    Toolbar.mouseArea = fig.svgElement.append('rect')
      .attr('class', 'toolbar_addon')
      .attr('id', 'mouse_area')
      .attr('width', fig.axWidth())
      .attr('height', fig.axHeight())
      .attr('transform', 'translate(' + fig.axMargin().left + ',' + fig.axMargin().top + ')')
      .style('fill', 'transparent')
      .style('opacity', '0')
      .style('pointer-events', 'all');
  }

  static addZoomArea () {
    Toolbar.brush = fig.svgElement.append('g')
      .attr('class', 'brush')
      .attr('width', fig.axWidth())
      .attr('height', fig.axHeight())
      .attr('transform', 'translate(' + fig.axMargin().left + ',' + fig.axMargin().top + ')')
      .style('fill', 'transparent');
  }

  static addMouseHandlerFunc (func) {
    Toolbar.addMouseArea();
    Toolbar.mouseArea.on('mousemove', function (e) {
      const coordinates = d3.mouse(this);
      func(coordinates);
    });
  }

  static dataCursorFunc (coordinates) {
    d3.select('.data_cursor').remove();
    if (!Sidebar.traceList.activeTrace.isVisible) {
      Toolbar.clean();
      alert('Active trace is hidden. Please select a visible active trace.');
      return;
    }
    var xExact = fig.ax.xScale.invert(coordinates[0]);
    var point = fig.ax.activeGraph.xyData.nearestPoint(xExact);
    if (!point.x) {
      return;
    }

    var cursor = fig.ax.dataAxElem.append('g')
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
    let xStr = d3.format('.' + fig.ax.activeGraph.xyData.precisionX() + '~f')(point.x);
    let yStr = d3.format('.' + fig.ax.activeGraph.xyData.precisionY() + '~f')(point.y);
    document.querySelector('#toolbar #x_coord').textContent = 'x = ' + xStr;
    document.querySelector('#toolbar #y_coord').textContent = 'y = ' + yStr;
  }

  static zoomFunc () {
    Toolbar.clean();
    Toolbar.addZoomArea();
    Toolbar.zoomButton.classList.add('active');
    var brush = d3.brush()
      .extent([[0, 0], [fig.ax.width, fig.ax.height]])
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
        FigureArea.redraw();
        fig.svgElement.select('.brush').call(brush.move, null);
      });
    d3.select('.brush')
      .call(brush);
  }

  static panFunc () {
    function panDraw () {
      var xDelta = fig.ax.xScale.invert(1) - fig.ax.xScale.invert(0);
      var yDelta = fig.ax.yScale.invert(1) - fig.ax.yScale.invert(0);
      var transform = d3.event.transform;
      var xPan = transform.x;
      var yPan = transform.y;
      Sidebar.updateLimits(panDraw.startXLim[0] - xPan * xDelta,
        panDraw.startXLim[1] - xPan * xDelta,
        panDraw.startYLim[0] - yPan * yDelta,
        panDraw.startYLim[1] - yPan * yDelta);
      Sidebar.updatePlotStyle();
      fig.ax.panTransform(d3.event.transform);
      fig.ax.removeAxesDrawings();
      fig.ax.updateAxes();
      fig.ax.drawGrids();
      fig.ax.drawAxes();
    }

    panDraw.startXLim = fig.ax.xLim();
    panDraw.startYLim = fig.ax.yLim();

    Toolbar.mouseArea.call(d3.zoom()
      .scaleExtent([1, 1])
      .on('zoom', function () {
        panDraw();
      }));
  }
}

class ImageExport {
  static downloadSVG (fig, fileName) {
    var svgFileName = fileName + '.svg';
    var svg = fig.svgElementHtml;
    var svgUrl = ImageExport.getSvgUrl(svg);
    var downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = svgFileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  }

  static downloadPNG (fig, fileName) {
    var pngFileName = fileName + '.png';
    var svg = fig.svgElementHtml;
    var svgUrl = ImageExport.getSvgUrl(svg);
    var canvas = document.getElementById('cvs');
    canvas.width = svg.width.animVal.value * canvasResFactor;
    canvas.height = svg.height.animVal.value * canvasResFactor;
    var ctx = canvas.getContext('2d');
    var img = new Image();

    img.onload = function () {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      canvas.toBlob(function (blob) {
        saveAs(blob, pngFileName);
      });
    };
    img.src = svgUrl;
  }

  static getSvgUrl (svg) {
    var serializer = new XMLSerializer();
    var source = serializer.serializeToString(svg);

    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!source.match(/^<svg[^>]+"http:\/\/www\.w3\.org\/1999\/xlink"/)) {
      source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }

    source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
  }
}

class Util {
  // https://stackoverflow.com/questions/3329566/show-beginning-of-html-input-value-on-blur-with-javascript
  static resetPosition (element) {
    var v = element.value;
    element.value = '';
    setTimeout(function () { element.value = v; }, 1);
  }

  static toPercentWidth (intStrokeWidth) {
    return 0.1 * intStrokeWidth;
  }

  static toFloat (numStr) {
    return parseFloat(numStr.replace(/,/, '.'));
  }

  static formatPrecision (num) {
    var precision = 1;
    var orderOfMagn = Math.floor(Math.log10(Math.abs(num)));
    if (orderOfMagn < 0) {
      precision = -orderOfMagn + 1;
    } else if (orderOfMagn === 0) {
      precision = 2;
    } else if (orderOfMagn === 1) {
      precision = 1;
    } else {
      precision = 0;
    }
    return precision;
  }

  static stripFileExtension (fileName) {
    // https://stackoverflow.com/questions/4250364/how-to-trim-a-file-extension-from-a-string-in-javascript
    return fileName.replace(/\.[^/.]+$/, '');
  }

  static getSpan (arr) {
    return Math.abs(d3.max(arr) - d3.min(arr));
  }

  static orderOfMagnitude (arr) {
    let first = arr[0];
    let last = arr[arr.length - 1];
    let span = Math.abs(last - first);
    let estTickInterval = span / (2 * nTicks);
    return Math.floor(Math.log10(estTickInterval));
  }

  static numIsInteger (num) {
    return num % 1 === 0;
  }

  static appendStrtoArr (arr, str) {
    return arr.map(elem => elem + str);
  }

  // https://stackoverflow.com/questions/9895082/javascript-populate-drop-down-list-with-array
  static populateSelectBox (idSelector, optionArray) {
    var box = document.getElementById(idSelector);
    for (var i = 0; i < optionArray.length; i++) {
      var option = optionArray[i];
      var el = document.createElement('option');
      el.textContent = option;
      el.value = option;
      box.appendChild(el);
    }
  }

  static scaleArray (arr, multiplier) {
    arr.map(x => x * 2);
  }

  static regexParse (str) {
    var rowRe = /^\s*([+-]?[0-9]+(\.|,)?[0-9]*([eE][-+]?[0-9]+)?)\s*(,|;|\s)\s*([+-]?[0-9]+(\.|,)?[0-9]*([eE][-+]?[0-9]+)?)\s?$/mg;
    var arr;
    var x = [];
    var y = [];
    while (arr = rowRe.exec(str)) {
      x.push(Util.toFloat(arr[1]));
      y.push(Util.toFloat(arr[5]));
    }
    return [x, y];
  }

  static transformData (arr, varStr, transformationStr) {
    let maxRegex = new RegExp('max\\(\\s*' + varStr + '\\s*\\)', 'g');
    let minRegex = new RegExp('min\\(\\s*' + varStr + '\\s*\\)', 'g');
    let meanRegex = new RegExp('mean\\(\\s*' + varStr + '\\s*\\)', 'g');
    transformationStr = transformationStr.replace(maxRegex, math.max(arr));
    transformationStr = transformationStr.replace(minRegex, math.min(arr));
    transformationStr = transformationStr.replace(meanRegex, math.mean(arr));

    const expr = math.compile(transformationStr);
    arr = arr.map(function (x) {
      const scope = {};
      scope[varStr] = x;
      return expr.eval(scope);
    });
    return arr;
  }
}

var fig = new Figure('#figure_area');
Toolbar.initialize();
Sidebar.initialize();
FigureArea.initialize();
