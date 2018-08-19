/* Source code for the Quickplotter.com website.
Copyright © 2018 Joona Rissanen.
Quickplotter.com uses several open source libraries and tools.
Their licenses are available at https://quickplotter.com/licenses.txt
*/

/* global FileReader */
/* global Image */
/* global saveAs */
/* global XMLSerializer */
/* global d3 */
/* global math */
/* global alert */
/* global curveFit */
/* global Blob */

const defaultPlotStyle = {
  'majorTickSize': 6, // %
  'minorTickSize': 4, // %
  'axisStrokeWidth': 2, // %/10
  'axisFontSize': 1.25, // %
  'axisFont': 'Sans-Serif',
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
  'marginPercent': { top: 0.05, bottom: 0.08, left: 0.08, right: 0.02 },
  'axisVisible': { top: true, bottom: true, left: true, right: true },
  'aspectRatio': 'none',
  'importFormat': 'x_y',
  'fileName': 'exported_graph'
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
  'markerStyle': 'Circle',
  'errorBar': {
    'errorBarType': 'off',
    'errorBarColor': 'black',
    'errorBarOpacity': '1.0',
    'errorBarLineStyle': 'solid',
    'errorBarStrokeWidth': 2,
    'capWidthMultiplier': 2.5,
    'errorBarXTransform': false,
    'errorBarYTransform': false}
};

const defaultFitStyle = {
  'xScaling': 'x',
  'yScaling': 'y',
  'plotType': 'line',
  'markerSize': 10,
  'lineStrokeWidth': '2',
  'lineColor': 'red',
  'markerColor': '#ff0000',
  'lineStyle': 'solid',
  'markerStyle': 'Circle',
  'errorBar': {
    'errorBarType': 'off',
    'errorBarColor': 'black',
    'errorBarOpacity': '1.0',
    'errorBarLineStyle': 'solid',
    'errorBarStrokeWidth': 2,
    'capWidthMultiplier': 2.5,
    'errorBarXTransform': false,
    'errorBarYTransform': false}
};

const kellyColorsAndBlack = [
  '#000000',
  '#C10020',
  '#00538A',
  '#007D34',
  '#FFB300',
  '#803E75',
  '#FF6800',
  '#A6BDD7',
  '#CEA262',
  '#817066',
  '#F6768E',
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

const canvasResFactor = 3;
const nTicks = 5;
const fontSizesInt = d3.range(0.0, 3.6, 0.25);
const strokeWidthsInt = d3.range(0, 6.1, 0.5);
const markerSizes = d3.range(0, 21, 1);
const tickSizes = d3.range(-6, 11, 1);
const opacities = d3.range(0.1, 1.01, 0.1).map(e => e.toFixed(1));

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

class FigureArea {
  static initialize () {
    document.getElementById('figure_area').addEventListener('paste', FigureArea.readPasteAndPlot);
    document.getElementById('figure_area').addEventListener('drop', FigureArea.dropHandler);
    document.getElementById('figure_area').addEventListener('dragover', FigureArea.dragOverHandler);
    window.addEventListener('resize', function () {
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
    reader.onload = (function () {
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
    let parser = new RegexParser(currentPlotStyle.importFormat);
    let cols = parser.parse(str);
    if (!cols) {
      return;
    }
    let strippedFileName = Util.stripFileExtension(fileName);
    currentPlotStyle.fileName = strippedFileName;
    let traceStyle = Object.assign({}, currentTraceStyle);
    let newTrace = new Trace(cols, traceStyle, strippedFileName);
    Sidebar.traceList.addTrace(newTrace);

    Sidebar.resetLimits();
    Sidebar.show();
    Toolbar.show();
    FigureArea.redraw();
    FigureArea.hideInstruction();
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
    if (traces.length === 0) {
      return;
    }

    for (var i = 0; i < traces.length; i++) {
      let trace = traces[i];
      let x = trace.xTransformed;
      let y = trace.yTransformed;
      let xErr = trace.xErrTransformed;
      let yErr = trace.yErrTransformed;
      let style = trace.style;
      ax.plot(x, y, xErr, yErr, style);
    }

    fig.draw();
    ax.addXLabel(Sidebar.xLabel, fig.svgPercentageToPx(currentPlotStyle['xLabelFontSize']), currentPlotStyle.labelFont);
    ax.addYLabel(Sidebar.yLabel, fig.svgPercentageToPx(currentPlotStyle['yLabelFontSize']), currentPlotStyle.labelFont);
    ax.addTitle(Sidebar.title, fig.svgPercentageToPx(currentPlotStyle['titleFontSize']), currentPlotStyle.labelFont);
    ax.addLegend(currentPlotStyle.legendLocation, fig.svgPercentageToPx(currentPlotStyle.axisFontSize));
    Toolbar.applyMargin();
    Toolbar.reactivateButton();
  }
}

class Trace {
  constructor (cols, style, label) {
    this.cols = cols;
    this.hasXError = cols.hasOwnProperty('xErr');
    this.hasYError = cols.hasOwnProperty('yErr');
    this.style = style;
    this.traceLabel = label;
    this.isVisible = true;
  }

  get legendColor () {
    if (this.style.plotType === 'scatter') {
      return this.style.markerColor;
    }
    return this.style.lineColor;
  }

  transformArray (input, label, scaling) {
    let output = input;
    try {
      output = Util.transformData(input, label, scaling);
    } catch (exception) {
      console.error(exception);
      alert('Function not recognized!');
    }
    return output;
  }

  get xTransformed () {
    let x = this.cols.x.slice();
    return this.transformArray(x, 'x', this.style.xScaling);
  }

  get yTransformed () {
    let y = this.cols.y.slice();
    return this.transformArray(y, 'y', this.style.yScaling);
  }

  get xErrTransformed () {
    if (!this.hasXError) {
      return null;
    }
    let xErr = this.cols.xErr.slice();
    if (this.style.errorBar.errorBarXTransform) {
      xErr = this.transformArray(xErr, 'x', this.style.xScaling);
    }
    return xErr;
  }

  get yErrTransformed () {
    if (!this.hasYError) {
      return null;
    }
    let yErr = this.cols.yErr.slice();
    if (this.style.errorBar.errorBarYTransform) {
      yErr = this.transformArray(yErr, 'y', this.style.yScaling);
    }
    return yErr;
  }
}

class XYData {
  constructor (x, y, xErr, yErr) {
    this.x = [];
    this.y = [];

    if (xErr === null) {
      this.xErr = null;
    } else {
      this.xErr = [];
    }

    if (yErr === null) {
      this.yErr = null;
    } else {
      this.yErr = [];
    }

    // Nan removal
    for (let i = 0; i < x.length; i++) {
      if (Number.isFinite(x[i]) &&
        Number.isFinite(y[i]) &&
        (xErr === null || Number.isFinite(xErr[i])) &&
        (yErr === null || Number.isFinite(yErr[i]))) {
        this.x.push(x[i]);
        this.y.push(y[i]);
        if (!(xErr === null)) {
          this.xErr.push(xErr[i]);
        }
        if (!(yErr === null)) {
          this.yErr.push(yErr[i]);
        }
      }
    }

    // upper and lower limits
    this.xMinArr = this.x.slice();
    this.xMaxArr = this.x.slice();
    this.yMinArr = this.y.slice();
    this.yMaxArr = this.y.slice();

    if (this.hasXError) {
      for (let i = 0; i < this.x.length; i++) {
        this.xMinArr[i] -= this.xErr[i];
        this.xMaxArr[i] += this.xErr[i];
      }
    }

    if (this.hasYError) {
      for (let i = 0; i < this.x.length; i++) {
        this.yMinArr[i] -= this.yErr[i];
        this.yMaxArr[i] += this.yErr[i];
      }
    }

    this.xMin = d3.min(this.xMinArr);
    this.xMax = d3.max(this.xMaxArr);
    this.yMin = d3.min(this.yMinArr);
    this.yMax = d3.max(this.yMaxArr);

    this.xIsSorted = Util.isSorted(this.x);
    // this.xIsReverseSorted = Util.isSorted(this.x.slice().reverse());
  }

  get hasXError () {
    return this.xErr != null;
  }

  get hasYError () {
    return this.yErr != null;
  }

  nearestPoint (x0) {
    let pos;
    if (this.xIsSorted) {
      pos = d3.bisectLeft(this.x, x0, 0, this.x.length);
      var prev = this.x[pos];
      var next = this.x[pos];
      var idx = x0 - prev < next - x0 ? pos - 1 : pos;
      return {
        'x': this.x[idx],
        'y': this.y[idx]
      };
    } else {
      return null;
    }
  }

  get xRange () {
    return Math.abs(this.xMax - this.xMin);
  }

  get yRange () {
    return Math.abs(this.yMax - this.yMin);
  }

  makeLineData (labels) {
    var lineData = [];
    for (var i = 0; i < this.x.length; i++) {
      let point = {};
      for (var j = 0; j < labels.length; j++) {
        point[labels[j]] = this[labels[j]][i];
      }
      lineData.push(point);
    }
    return lineData;
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

  get parentWidth () {
    return this.parentElement.offsetWidth;
  }

  get parentHeight () {
    return this.parentElement.offsetHeight;
  }

  get width () {
    let aspectRatio = currentPlotStyle.aspectRatio;
    if (aspectRatio === 'none') {
      return this.parentWidth;
    } else {
      return Math.min(this.parentWidth, this.parentHeight / aspectRatio);
    }
  }

  get height () {
    let aspectRatio = currentPlotStyle.aspectRatio;
    if (aspectRatio === 'none') {
      return this.parentHeight;
    } else {
      return Math.min(this.parentHeight, this.parentWidth * aspectRatio);
    }
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
    if (this.ax) {
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

  plot (x, y, xErr, yErr, style) {
    let graph = new Graph(x, y, xErr, yErr, style);
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

    this.gridElem = this.dataAxElem.append('g');
    this.graphElem = this.dataAxElem.append('g');
    this.fitElem = this.dataAxElem.append('g');
    this.axisElem = this.dataAxElem.append('g');

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
    var dataAxElem = this.graphElem;
    this.graphList.map(function (graph) { graph.draw(dataAxElem, xScale, yScale); });
  }

  resetFitGroup () {
    this.fitElem.selectAll('*').remove();
  }

  remove () {
    if (this.dataAxElem) {
      this.dataAxElem.remove();
    }
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
    this.xAxis.draw(this.axisElem);
    this.xAxisTop.draw(this.axisElem);
    this.yAxis.draw(this.axisElem);
    this.yAxisRight.draw(this.axisElem);
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
    this.xAxis.drawMajorGrid(this.gridElem, currentPlotStyle['verticalGrid']);
    this.yAxis.drawMajorGrid(this.gridElem, currentPlotStyle['horizontalGrid']);
    this.xAxis.drawMinorGrid(this.gridElem, currentPlotStyle['verticalMinorGrid']);
    this.yAxis.drawMinorGrid(this.gridElem, currentPlotStyle['horizontalMinorGrid']);
  }

  createCoordAxis (orientation, translatePosition, htmlClass, tickLabelsVisible, labelTranslate) {
    let majorTickSize = this.parentFig.svgPercentageToPxInt(Util.toPercentWidth(currentPlotStyle['majorTickSize']));
    let minorTickSize = this.parentFig.svgPercentageToPxInt(Util.toPercentWidth(currentPlotStyle['minorTickSize']));
    let axisFontSize = this.parentFig.svgPercentageToPx(currentPlotStyle['axisFontSize']);
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
    const font = '16px arial';
    let labelWidths = legendData.map(e => Util.getTextWidth(e.traceLabel, font));
    const legendWidth = d3.max(labelWidths) + 32;

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
      .attr('font-family', currentPlotStyle.labelFont)
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
        return d.traceLabel;
      });
  }

  addTitle (titleText, fontSize, fontFamily) {
    let center = Math.floor(this.width / 2);
    this.dataAxElem.selectAll('.title').remove();
    this.dataAxElem.append('text')
      .attr('class', 'title')
      .attr('text-anchor', 'middle')
      .attr('x', center)
      .attr('y', -this.parentFig.svgPercentageToPxInt(1))
      .attr('font-family', fontFamily)
      .attr('font-size', fontSize)
      .html(titleText);
  }

  addXLabel (labelText, fontSize, fontFamily) {
    let center = Math.floor(this.width / 2);
    this.dataAxElem.selectAll('.x_label').remove();
    this.dataAxElem.append('text')
      .attr('class', 'x_label')
      .attr('text-anchor', 'middle')
      .attr('x', center)
      .attr('y', this.height + this.parentFig.svgPercentageToPxInt(4))
      .attr('dy', '0.35em')
      .attr('font-family', fontFamily)
      .attr('font-size', fontSize)
      .html(labelText);
  }

  addYLabel (labelText, fontSize, fontFamily) {
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
      .attr('font-family', fontFamily)
      .attr('font-size', fontSize)
      .html(labelText);
  }

  xLim () {
    const userLimits = [currentPlotStyle['xStart'], currentPlotStyle['xEnd']];
    let margin = this.graphMargin(currentPlotStyle.graphMarginX, userLimits);
    let dataLimitList = this.graphList.map(function (e) { return e.xLim(margin); });
    let dataLimits = this.dataLimitsFromList(dataLimitList);
    return this.getCoordinateLimits(dataLimits, userLimits);
  }

  yLim () {
    const userLimits = [currentPlotStyle['yStart'], currentPlotStyle['yEnd']];
    let margin = this.graphMargin(currentPlotStyle.graphMarginY, userLimits);
    let dataLimitList = this.graphList.map(function (e) { return e.yLim(margin); });
    let dataLimits = this.dataLimitsFromList(dataLimitList);
    return this.getCoordinateLimits(dataLimits, userLimits);
  }

  graphMargin (defaultMargin, userLimits) {
    let margin = [defaultMargin, defaultMargin];
    if (userLimits[0] === 'tight') {
      margin[0] = 0;
    }
    if (userLimits[1] === 'tight') {
      margin[1] = 0;
    }
    return margin;
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
    let lim = dataLimits;
    if (!['auto', 'tight'].includes(userLimits[0])) {
      lim[0] = Util.toFloat(userLimits[0]);
    }
    if (!['auto', 'tight'].includes(userLimits[1])) {
      lim[1] = Util.toFloat(userLimits[1]);
    }
    return lim;
  }

  panTransform (transform) {
    for (let i = 0; i < this.graphList.length; i++) {
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
    this.isVisible = currentPlotStyle.axisVisible[this.orientation];
  }

  update (scale, limits) {
    this.scale = scale;
    this.limits = limits;
    var suggestedTickValues = this.scale.ticks(nTicks);
    this.tickValues = this.addMinorTicks(suggestedTickValues, this.limits);
    this.firstTickIsMajor = (suggestedTickValues[0] === this.tickValues[0]) ? 0 : 1;
    let firstTickIsMajor = this.firstTickIsMajor;
    this.majorTickValues = this.tickValues.filter(function (item, idx) {
      return (idx + firstTickIsMajor) % 2 === 0;
    });
    this.minorTickValues = this.tickValues.filter(function (item, idx) {
      return (idx + firstTickIsMajor) % 2 !== 0;
    });
  }

  draw (axElem) {
    var tickFormat = this.getTickFormat(this.majorTickValues);
    var axis = this.makeAxisFunc(this.scale, this.tickValues, tickFormat);
    const opacity = this.isVisible ? 1 : 0;
    // Add axes to the ax group
    axElem.append('g')
      .attr('transform', 'translate(' + this.translatePosition[0] + ',' + this.translatePosition[1] + ')')
      .attr('class', this.htmlId)
      .attr('stroke-width', fig.svgPercentageToPx(Util.toPercentWidth(currentPlotStyle['axisStrokeWidth'])))
      .style('font-family', currentPlotStyle.axisFont)
      .style('font-size', this.axisFontSize)
      .style('opacity', opacity)
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
    let firstTickIsMajor = this.firstTickIsMajor;

    // Main X and Y axes: remove minor tick labels
    if (isVisible) {
      tickLabels.attr('class', function (d, i) {
        if ((i + firstTickIsMajor) % 2 !== 0) d3.select(this).remove();
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
    let firstTickIsMajor = this.firstTickIsMajor;

    tickLines.attr(tickCoordinate, function (d, i) {
      return ((i + firstTickIsMajor) % 2 === 0) ? majorTickSize : minorTickSize;
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
    var orderOfMagn = Util.tickOrderOfMagnitude(ticks);
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
  constructor (x, y, xErr, yErr, style) {
    this.style = style;
    if (!style.errorBar.errorBarType.includes('x')) {
      xErr = null;
    }
    if (!style.errorBar.errorBarType.includes('y')) {
      yErr = null;
    }
    this.xyData = new XYData(x, y, xErr, yErr);
  }

  xLim (margin) {
    return this.dataLim(this.xyData.xMin, this.xyData.xMax, this.xyData.xRange, margin);
  }

  yLim (margin) {
    return this.dataLim(this.xyData.yMin, this.xyData.yMax, this.xyData.yRange, margin);
  }

  dataLim (min, max, range, margin) {
    return [min - range * margin[0], max + range * margin[1]];
  }

  makeDataPoints () {
    let pointLabels = ['x', 'y'];
    if (this.xyData.hasXError) {
      pointLabels.push('xErr');
    }
    if (this.xyData.hasYError) {
      pointLabels.push('yErr');
    }
    return this.xyData.makeLineData(pointLabels);
  }

  draw (axElem, xScale, yScale) {
    let dataPoints = this.makeDataPoints();
    this.clipGroup = axElem.append('g')
      .attr('clip-path', 'url(#clip_path)');
    this.plotGroup = this.clipGroup.append('g');
    this.drawErrors(dataPoints, xScale, yScale);
    this.drawData(dataPoints, xScale, yScale);
  }

  drawData (dataPoints, xScale, yScale) {
    var plotType = this.style.plotType;
    if (plotType === 'line') {
      this.drawLine(dataPoints, xScale, yScale);
    } else if (plotType === 'scatter') {
      this.drawScatter(dataPoints, xScale, yScale);
    } else if (plotType === 'line + scatter') {
      this.drawLine(dataPoints, xScale, yScale);
      this.drawScatter(dataPoints, xScale, yScale);
    } else if (plotType === 'area') {
      this.drawArea(dataPoints, xScale, yScale, 1);
    } else if (plotType === 'line + area') {
      this.drawLine(dataPoints, xScale, yScale);
      this.drawArea(dataPoints, xScale, yScale, 0.6);
    }
  }

  drawErrors (dataPoints, xScale, yScale) {
    let errorType = this.style.errorBar.errorBarType;
    if (errorType.includes('bar')) {
      if (this.xyData.hasXError) {
        this.drawXErrorBars(dataPoints, xScale, yScale);
      }
      if (this.xyData.hasYError) {
        this.drawYErrorBars(dataPoints, xScale, yScale);
      }
    } else if (errorType.includes('area')) {
      if (this.xyData.hasYError) {
        this.drawErrorArea(dataPoints, xScale, yScale);
      }
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

  drawArea (dataPoints, xScale, yScale, opacity) {
    let areaFunc = d3.area()
      .x(d => xScale(d.x))
      .y0(yScale(0))
      .y1(d => yScale(d.y));
    this.plotGroup.append('g').append('path')
      .attr('class', 'area')
      .attr('fill', this.style.lineColor)
      .style('opacity', opacity)
      .attr('d', areaFunc(dataPoints));
  }

  drawXErrorBars (dataPoints, xScale, yScale) {
    let strokeWidthInt = fig.svgPercentageToPxInt(Util.toPercentWidth(this.style.errorBar.errorBarStrokeWidth));
    let capHalfWidth = strokeWidthInt * this.style.errorBar.capWidthMultiplier;
    let strokeWidth = strokeWidthInt + 'px';

    this.plotGroup.append('g').selectAll('line')
      .data(dataPoints).enter()
      .append('line')
      .attr('class', 'error-bar-line')
      .attr('x1', d => xScale(d.x - d.xErr))
      .attr('x2', d => xScale(d.x + d.xErr))
      .attr('y1', d => yScale(d.y))
      .attr('y2', d => yScale(d.y))
      .attr('stroke', this.style.errorBar.errorBarColor)
      .attr('stroke-dasharray', this.errorBarDashArray())
      .attr('stroke-width', strokeWidth);

    this.plotGroup.append('g').selectAll('line')
      .data(dataPoints).enter()
      .append('line')
      .attr('class', 'error-bar-cap-line')
      .attr('x1', d => xScale(d.x - d.xErr))
      .attr('x2', d => xScale(d.x - d.xErr))
      .attr('y1', d => yScale(d.y) - capHalfWidth)
      .attr('y2', d => yScale(d.y) + capHalfWidth)
      .attr('stroke', this.style.errorBar.errorBarColor)
      .attr('stroke-width', strokeWidth);

    this.plotGroup.append('g').selectAll('line')
      .data(dataPoints).enter()
      .append('line')
      .attr('class', 'error-bar-cap-line')
      .attr('x1', d => xScale(d.x + d.xErr))
      .attr('x2', d => xScale(d.x + d.xErr))
      .attr('y1', d => yScale(d.y) - capHalfWidth)
      .attr('y2', d => yScale(d.y) + capHalfWidth)
      .attr('stroke', this.style.errorBar.errorBarColor)
      .attr('stroke-width', strokeWidth);
  }

  drawYErrorBars (dataPoints, xScale, yScale) {
    let strokeWidthInt = fig.svgPercentageToPxInt(Util.toPercentWidth(this.style.errorBar.errorBarStrokeWidth));
    let capHalfWidth = strokeWidthInt * this.style.errorBar.capWidthMultiplier;
    let strokeWidth = strokeWidthInt + 'px';

    this.plotGroup.append('g').selectAll('line')
      .data(dataPoints).enter()
      .append('line')
      .attr('class', 'error-bar-line')
      .attr('x1', d => xScale(d.x))
      .attr('x2', d => xScale(d.x))
      .attr('y1', d => yScale(d.y - d.yErr))
      .attr('y2', d => yScale(d.y + d.yErr))
      .attr('stroke', this.style.errorBar.errorBarColor)
      .attr('stroke-dasharray', this.errorBarDashArray())
      .attr('stroke-width', strokeWidth);

    this.plotGroup.append('g').selectAll('line')
      .data(dataPoints).enter()
      .append('line')
      .attr('class', 'error-bar-cap-line')
      .attr('x1', d => xScale(d.x) - capHalfWidth)
      .attr('x2', d => xScale(d.x) + capHalfWidth)
      .attr('y1', d => yScale(d.y - d.yErr))
      .attr('y2', d => yScale(d.y - d.yErr))
      .attr('stroke', this.style.errorBar.errorBarColor)
      .attr('stroke-width', strokeWidth);

    this.plotGroup.append('g').selectAll('line')
      .data(dataPoints).enter()
      .append('line')
      .attr('class', 'error-bar-cap-line')
      .attr('x1', d => xScale(d.x) - capHalfWidth)
      .attr('x2', d => xScale(d.x) + capHalfWidth)
      .attr('y1', d => yScale(d.y + d.yErr))
      .attr('y2', d => yScale(d.y + d.yErr))
      .attr('stroke', this.style.errorBar.errorBarColor)
      .attr('stroke-width', strokeWidth);
  }

  drawErrorArea (dataPoints, xScale, yScale) {
    let errorAreaFunc = d3.area()
      .x(d => xScale(d.x))
      .y0(d => yScale(d.y - d.yErr))
      .y1(d => yScale(d.y + d.yErr));
    this.plotGroup.append('g').append('path')
      .attr('class', 'area')
      .attr('fill', this.style.errorBar.errorBarColor)
      .style('opacity', this.style.errorBar.errorBarOpacity)
      .attr('d', errorAreaFunc(dataPoints));
  }

  errorBarDashArray () {
    let dashArray = ('1, 0');
    if (this.style.errorBar.errorBarLineStyle === 'solid') {
      dashArray = ('1, 0');
    } else if (this.style.errorBar.errorBarLineStyle === 'dashed') {
      dashArray = ('6, 6');
    }
    return dashArray;
  }

  panTransform (transform) {
    if (this.plotGroup) {
      this.plotGroup.attr('transform', transform);
    }
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
    let legendData = [];
    for (var i = 0; i < this.traces.length; i++) {
      var trace = this.traces[i];
      if (trace.isVisible) {
        legendData.push({
          'traceLabel': trace.traceLabel,
          'color': trace.legendColor
        });
      }
    }
    return legendData;
  }

  updateActiveTraceStyle (newStyle) {
    if (this.activeTrace) {
      this.activeTrace.style = newStyle;
      this.updateActiveTraceColorSquare();
    }
  }

  activateTrace (listIdx) {
    if (this.activeTraceIdx >= 0) {
      this.deactivateRow(this.activeTraceIdx);
    }
    this.activeTraceIdx = listIdx;
    this.activateRow(this.activeTraceIdx);
  }

  deactivateRow (idx) {
    this.htmlTableBody.rows[idx].classList.remove('active');
  }

  activateRow (idx) {
    this.htmlTableBody.rows[idx].classList.add('active');
  }

  updateTraceLabels () {
    for (var i = 0; i < this.traces.length; i++) {
      let input = this.htmlTableBody.rows[i].querySelector('input');
      this.traces[i].traceLabel = input.value;
    }
  }

  updateActiveTraceColorSquare () {
    let colorSquare = this.htmlTableBody.querySelector('.active .color_square');
    colorSquare.style.backgroundColor = this.activeTrace.legendColor;
  }

  addTrace (trace, color) {
    this.colorGenerator.idx = this.traces.length;
    if (!color) {
      color = this.colorGenerator.nextColor();
    }
    trace.style.markerColor = color;
    trace.style.lineColor = color;
    this.traces.push(trace);
    currentTraceStyle = Object.assign({}, trace.style);
    this.addTableRow(trace.traceLabel, trace.legendColor);
    this.activateTrace(this.traces.length - 1);
    Sidebar.showCurrentTraceStyle();
  }

  deleteTrace (listIdx) {
    if (listIdx <= this.activeTraceIdx) {
      this.activeTraceIdx = this.traces.length - 2;
    }
    this.traces.splice(listIdx, 1);
    this.deleteTableRow(listIdx);
  }

  addTableRow (label, color) {
    let tableBody = this.htmlTableBody;
    var addedRow = tableBody.insertRow(tableBody.rows.length);
    var cell = addedRow.insertCell(0);
    var textCell = document.createElement('div');
    var buttonCell = document.createElement('div');
    cell.appendChild(textCell);
    cell.appendChild(buttonCell);

    textCell.classList.add('text_cell');
    buttonCell.classList.add('button_cell');

    // https://stackoverflow.com/questions/45656949/how-to-return-the-row-and-column-index-of-a-table-cell-by-clicking
    addedRow.addEventListener('dblclick', function (e) {
      const rowList = Array.from(tableBody.rows);
      const rowIdx = rowList.findIndex(row => row.contains(e.target));
      Sidebar.activateTrace(rowIdx);
    });

    var colorSquare = document.createElement('div');
    colorSquare.classList.add('color_square');
    colorSquare.style.backgroundColor = color;

    var txt = document.createElement('input');
    txt.type = 'text';
    txt.value = label;
    txt.contentEditable = true;
    txt.addEventListener('change', function (event) {
      Sidebar.traceList.updateTraceLabels();
      FigureArea.redraw();
    });

    var showHideButton = document.createElement('button');
    showHideButton.classList.add('trace_button');
    showHideButton.textContent = 'Hide';
    showHideButton.addEventListener('click', function (e) {
      showHideButton.textContent = showHideButton.textContent === 'Hide' ? 'Show' : 'Hide';
      const rowList = Array.from(tableBody.rows);
      const rowIdx = rowList.findIndex(row => row.contains(e.target));
      tableBody.rows[rowIdx].classList.toggle('trace-hidden');
      Sidebar.toggleTraceVisibility(rowIdx);
    });
    var clearButton = document.createElement('button');
    clearButton.classList.add('trace_button');
    clearButton.textContent = 'Clear';
    clearButton.addEventListener('click', function (e) {
      const rowList = Array.from(tableBody.rows);
      const rowIdx = rowList.findIndex(row => row.contains(e.target));
      Sidebar.deleteTrace(rowIdx);
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

class Sidebar {
  static initialize () {
    Sidebar.populateSelectionBoxes();
    Sidebar.initDefaultValues();
    Sidebar.addRedrawListeners();
    Sidebar.addLabelListeners();
    Sidebar.addTooltipListeners();
    Sidebar.addAccordionListeners();
    Sidebar.addLimitButtonListeners();
    Sidebar.traceList = new TraceList();
  }

  static show () {
    document.getElementById('sidebar').style.display = 'block';
  }

  static addAccordionListeners () {
    let accordionButtons = document.getElementsByClassName('accordion-button');
    for (let i = 0; i < accordionButtons.length; i++) {
      accordionButtons[i].addEventListener('click', function () {
        this.classList.toggle('accordion-active');
        let content = this.nextElementSibling;
        content.style.display = content.style.display === 'block' ? 'none' : 'block';
      });
    }
  }

  static addLabelListeners () {
    document.getElementById('xLabel').addEventListener('input', function (event) {
      fig.ax.addXLabel(document.getElementById('xLabel').value, fig.svgPercentageToPx(currentPlotStyle['xLabelFontSize']), currentPlotStyle.labelFont);
    });
    document.getElementById('yLabel').addEventListener('input', function (event) {
      fig.ax.addYLabel(document.getElementById('yLabel').value, fig.svgPercentageToPx(currentPlotStyle['yLabelFontSize']), currentPlotStyle.labelFont);
    });
    document.getElementById('title').addEventListener('input', function (event) {
      fig.ax.addTitle(document.getElementById('title').value, fig.svgPercentageToPx(currentPlotStyle['titleFontSize']), currentPlotStyle.labelFont);
    });
  }

  static populateSelectionBoxes () {
    let fontSizesStr = Util.appendStrToArr(fontSizesInt, '%');
    Util.populateSelectBox('xFontSize', fontSizesStr);
    Util.populateSelectBox('yFontSize', fontSizesStr);
    Util.populateSelectBox('titleFontSize', fontSizesStr);
    Util.populateSelectBox('axisFontSize', fontSizesStr);
    Util.populateSelectBox('lineStrokeWidth', strokeWidthsInt);
    Util.populateSelectBox('axisStrokeWidth', strokeWidthsInt);
    Util.populateSelectBox('markerSize', markerSizes);
    Util.populateSelectBox('majorTickSize', tickSizes);
    Util.populateSelectBox('minorTickSize', tickSizes);
    Util.populateSelectBox('errorBarOpacity', opacities);
    Util.populateSelectBox('errorBarStrokeWidth', strokeWidthsInt);
  }

  static initDefaultValues () {
    document.getElementById('xFontSize').value = defaultPlotStyle['xLabelFontSize'] + '%';
    document.getElementById('yFontSize').value = defaultPlotStyle['yLabelFontSize'] + '%';
    document.getElementById('titleFontSize').value = defaultPlotStyle['titleFontSize'] + '%';
    document.getElementById('axisFontSize').value = defaultPlotStyle['axisFontSize'] + '%';
    document.getElementById('axisStrokeWidth').value = defaultPlotStyle['axisStrokeWidth'];
    document.getElementById('xAxisVisibility').checked = defaultPlotStyle['axisVisible'].bottom;
    document.getElementById('topXAxisVisibility').checked = defaultPlotStyle['axisVisible'].top;
    document.getElementById('yAxisVisibility').checked = defaultPlotStyle['axisVisible'].left;
    document.getElementById('rightYAxisVisibility').checked = defaultPlotStyle['axisVisible'].right;
    document.getElementById('majorTickSize').value = defaultPlotStyle['majorTickSize'];
    document.getElementById('minorTickSize').value = defaultPlotStyle['minorTickSize'];

    document.getElementById('xScaling').value = defaultTraceStyle['xScaling'];
    document.getElementById('yScaling').value = defaultTraceStyle['yScaling'];
    document.getElementById('lineStrokeWidth').value = defaultTraceStyle['lineStrokeWidth'];
    document.getElementById('markerSize').value = defaultTraceStyle['markerSize'];
    document.getElementById('plotType').value = defaultTraceStyle['plotType'];

    document.getElementById('errorBarStrokeWidth').value = defaultTraceStyle.errorBar.errorBarStrokeWidth;
    document.getElementById('errorBarColor').value = defaultTraceStyle.errorBar.errorBarColor;
    document.getElementById('errorBarOpacity').value = defaultTraceStyle.errorBar.errorBarOpacity;
    document.getElementById('errorBarType').value = defaultTraceStyle.errorBar.errorBarType;

    document.getElementById('importFormat').value = defaultPlotStyle.importFormat;
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
    var params = ['xFontSize', 'yFontSize', 'titleFontSize', 'labelFont',
      'xStart', 'xEnd',
      'yStart', 'yEnd',
      'plotType',
      'lineColor', 'markerColor',
      'lineStyle', 'markerStyle',
      'lineStrokeWidth', 'markerSize',
      'axisStrokeWidth', 'axisFontSize',
      'axisFont',
      'minorTickSize', 'majorTickSize',
      'horizontalGrid', 'verticalGrid',
      'horizontalMinorGrid', 'verticalMinorGrid',
      'xAxisVisibility', 'topXAxisVisibility',
      'yAxisVisibility', 'rightYAxisVisibility',
      'legendLocation', 'aspectRatio',
      'errorBarType', 'errorBarStrokeWidth', 'errorBarLineStyle',
      'errorBarColor', 'errorBarOpacity',
      'errorBarXTransform', 'errorBarYTransform', 'importFormat'];
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
    let elementsWithTooltip = document.querySelectorAll('.has-tooltip');
    for (let i = 0; i < elementsWithTooltip.length; i++) {
      let tooltipElem = elementsWithTooltip[i];
      let input = tooltipElem.querySelector('select, input');
      let tooltip = tooltipElem.querySelector('.tooltip-wrapper');
      tooltipElem.addEventListener('mouseover', function (event) {
        tooltip.style.display = 'block';
        tooltip.style.top = Sidebar.getTooltipPositionPx(tooltipElem);
        if (input != null) { // null check for traceTable -> consider refactoring
          input.classList.add('active');
        }
      });
      tooltipElem.addEventListener('mouseout', function (event) {
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

  static addLimitButtonListeners () {
    let limitRows = document.querySelectorAll('.inline-row--limit-row');
    for (let i = 0; i < limitRows.length; i++) {
      let input = limitRows[i].querySelector('.limit_input');
      let autoButton = limitRows[i].querySelector('.auto-button');
      let tightButton = limitRows[i].querySelector('.tight-button');

      autoButton.addEventListener('click', function () {
        input.value = 'auto';
        FigureArea.redraw();
      });

      tightButton.addEventListener('click', function () {
        input.value = 'tight';
        FigureArea.redraw();
      });
    }
  }

  static updatePlotStyle () {
    currentPlotStyle['xLabelFontSize'] = Sidebar.xLabelFontSize;
    currentPlotStyle['yLabelFontSize'] = Sidebar.yLabelFontSize;
    currentPlotStyle['titleFontSize'] = Sidebar.titleFontSize;
    currentPlotStyle['labelFont'] = Sidebar.labelFont;
    currentPlotStyle['xStart'] = Sidebar.xStart;
    currentPlotStyle['xEnd'] = Sidebar.xEnd;
    currentPlotStyle['yStart'] = Sidebar.yStart;
    currentPlotStyle['yEnd'] = Sidebar.yEnd;
    currentPlotStyle['axisStrokeWidth'] = Sidebar.axisStrokeWidth;
    currentPlotStyle['axisFontSize'] = Sidebar.axisFontSize;
    currentPlotStyle['axisFont'] = Sidebar.axisFont;
    currentPlotStyle['horizontalGrid'] = Sidebar.horizontalGrid;
    currentPlotStyle['verticalGrid'] = Sidebar.verticalGrid;
    currentPlotStyle['horizontalMinorGrid'] = Sidebar.horizontalMinorGrid;
    currentPlotStyle['verticalMinorGrid'] = Sidebar.verticalMinorGrid;

    currentPlotStyle['axisVisible'].top = Sidebar.topXAxisVisibility;
    currentPlotStyle['axisVisible'].right = Sidebar.rightYAxisVisibility;
    currentPlotStyle['axisVisible'].bottom = Sidebar.xAxisVisibility;
    currentPlotStyle['axisVisible'].left = Sidebar.yAxisVisibility;

    currentPlotStyle['minorTickSize'] = Sidebar.minorTickSize;
    currentPlotStyle['majorTickSize'] = Sidebar.majorTickSize;

    currentPlotStyle['activeTrace'] = Sidebar.activeTrace;
    currentPlotStyle['legendLocation'] = Sidebar.legendLocation;
    currentPlotStyle['aspectRatio'] = Sidebar.aspectRatio;

    currentTraceStyle['xScaling'] = Sidebar.xScaling;
    currentTraceStyle['yScaling'] = Sidebar.yScaling;
    currentTraceStyle['plotType'] = Sidebar.plotType;
    currentTraceStyle['lineColor'] = Sidebar.lineColor;
    currentTraceStyle['markerColor'] = Sidebar.markerColor;
    currentTraceStyle['lineStyle'] = Sidebar.lineStyle;
    currentTraceStyle['markerStyle'] = Sidebar.markerStyle;
    currentTraceStyle['lineStrokeWidth'] = Sidebar.lineStrokeWidth;
    currentTraceStyle['markerSize'] = Sidebar.markerSize;
    currentTraceStyle.errorBar.errorBarType = Sidebar.errorBarType;
    currentTraceStyle.errorBar.errorBarColor = Sidebar.errorBarColor;
    currentTraceStyle.errorBar.errorBarStrokeWidth = Sidebar.errorBarStrokeWidth;
    currentTraceStyle.errorBar.errorBarLineStyle = Sidebar.errorBarLineStyle;
    currentTraceStyle.errorBar.errorBarOpacity = Sidebar.errorBarOpacity;
    currentTraceStyle.errorBar.errorBarXTransform = Sidebar.errorBarXTransform;
    currentTraceStyle.errorBar.errorBarYTransform = Sidebar.errorBarYTransform;

    currentPlotStyle['importFormat'] = Sidebar.importFormat;
    Sidebar.traceList.updateActiveTraceStyle(Object.assign({}, currentTraceStyle));
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
      Toolbar.clean();
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

    document.getElementById('errorBarType').value = currentTraceStyle.errorBar.errorBarType;
    document.getElementById('errorBarStrokeWidth').value = currentTraceStyle.errorBar.errorBarStrokeWidth;
    document.getElementById('errorBarColor').value = currentTraceStyle.errorBar.errorBarColor;
    document.getElementById('errorBarOpacity').value = currentTraceStyle.errorBar.errorBarOpacity;
    document.getElementById('errorBarLineStyle').value = currentTraceStyle.errorBar.errorBarLineStyle;
    document.getElementById('errorBarXTransform').checked = currentTraceStyle.errorBar.errorBarXTransform;
    document.getElementById('errorBarYTransform').checked = currentTraceStyle.errorBar.errorBarYTransform;
  }

  static get title () {
    return document.getElementById('title').value;
  }

  static get xLabel () {
    return document.getElementById('xLabel').value;
  }

  static get yLabel () {
    return document.getElementById('yLabel').value;
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

  static get labelFont () {
    return document.getElementById('labelFont').value;
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

  static get axisFont () {
    return document.getElementById('axisFont').value;
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

  static get xAxisVisibility () {
    return document.getElementById('xAxisVisibility').checked;
  }

  static get topXAxisVisibility () {
    return document.getElementById('topXAxisVisibility').checked;
  }

  static get yAxisVisibility () {
    return document.getElementById('yAxisVisibility').checked;
  }

  static get rightYAxisVisibility () {
    return document.getElementById('rightYAxisVisibility').checked;
  }

  static get majorTickSize () {
    return document.getElementById('majorTickSize').value;
  }

  static get minorTickSize () {
    return document.getElementById('minorTickSize').value;
  }

  static get legendLocation () {
    return document.getElementById('legendLocation').value;
  }

  static get importFormat () {
    return document.getElementById('importFormat').value;
  }

  static get errorBarType () {
    return document.getElementById('errorBarType').value;
  }

  static get errorBarStrokeWidth () {
    return document.getElementById('errorBarStrokeWidth').value;
  }

  static get errorBarOpacity () {
    return document.getElementById('errorBarOpacity').value;
  }

  static get errorBarColor () {
    return document.getElementById('errorBarColor').value;
  }

  static get errorBarLineStyle () {
    return document.getElementById('errorBarLineStyle').value;
  }

  static get errorBarXTransform () {
    return document.getElementById('errorBarXTransform').checked;
  }

  static get errorBarYTransform () {
    return document.getElementById('errorBarYTransform').checked;
  }

  static get aspectRatio () {
    let aspect = document.getElementById('aspectRatio').value;
    if (aspect === 'none') {
      return 'none';
    } else if (aspect === '1:1') {
      return 1.0;
    } else if (aspect === '1.1:1') {
      return 1.1;
    } else if (aspect === '1:1.1') {
      return 1 / 1.1;
    } else if (aspect === '1.2:1') {
      return 1.2;
    } else if (aspect === '1:1.2') {
      return 1 / 1.2;
    }
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
      ImageExport.downloadSVG(fig, currentPlotStyle.fileName);
    });
    document.getElementById('pngButton').addEventListener('click', function () {
      ImageExport.downloadPNG(fig, currentPlotStyle.fileName);
    });
    document.getElementById('csvButton').addEventListener('click', function () {
      if (Sidebar.traceList.activeTrace) {
        ImageExport.downloadCSV(Sidebar.traceList.activeTrace);
      }
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
    if (point === null) {
      Toolbar.clean();
      alert('Data cursor does not work with unsorted or reverse sorted data.');
      return;
    }
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
    const maxPx = 10000;
    const xPrecision = Util.formatPrecision(fig.ax.activeGraph.xyData.xRange / maxPx);
    const yPrecision = Util.formatPrecision(fig.ax.activeGraph.xyData.yRange / maxPx);
    let xStr = d3.format('.' + xPrecision + '~f')(point.x);
    let yStr = d3.format('.' + yPrecision + '~f')(point.y);
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

  static downloadCSV (trace) {
    let csvFileName = trace.traceLabel + '.csv';
    let x = trace.xTransformed;
    let y = trace.yTransformed;
    let outputRows = [];
    for (let i = 0; i < x.length; i++) {
      if (Number.isFinite(x[i]) && Number.isFinite(y[i])) {
        outputRows.push(x[i].toString() + ', ' + y[i].toString() + '\r\n');
      }
    }

    let csvStr = '';
    for (let i = 0; i < outputRows.length; i++) {
      csvStr += outputRows[i];
    }
    let csvBlob = new Blob([csvStr], {type: 'data:text/csv;charset=utf-8;'});
    saveAs(csvBlob, csvFileName);
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

class RegexParser {
  constructor (importFormat) {
    this.regexes = {
      2: /^\s*(?:([+-]?[0-9]+[.,]?[0-9]*(?:[eE][-+]?[0-9]+)?)\s*(?::|,|;|\s)\s*)\s*([+-]?[0-9]+[.,]?[0-9]*(?:[eE][-+]?[0-9]+)?)\s?$/mg,
      3: /^\s*(?:([+-]?[0-9]+[.,]?[0-9]*(?:[eE][-+]?[0-9]+)?)\s*(?::|,|;|\s)\s*)\s*(?:([+-]?[0-9]+[.,]?[0-9]*(?:[eE][-+]?[0-9]+)?)\s*(?::|,|;|\s)\s*)\s*([+-]?[0-9]+[.,]?[0-9]*(?:[eE][-+]?[0-9]+)?)\s?$/mg,
      4: /^\s*(?:([+-]?[0-9]+[.,]?[0-9]*(?:[eE][-+]?[0-9]+)?)\s*(?::|,|;|\s)\s*)\s*(?:([+-]?[0-9]+[.,]?[0-9]*(?:[eE][-+]?[0-9]+)?)\s*(?::|,|;|\s)\s*)\s*(?:([+-]?[0-9]+[.,]?[0-9]*(?:[eE][-+]?[0-9]+)?)\s*(?::|,|;|\s)\s*)\s*([+-]?[0-9]+[.,]?[0-9]*(?:[eE][-+]?[0-9]+)?)\s?$/mg
    };
    this.importFormat = importFormat;
    this.colLabels = this.importFormat.split('_');
    this.nCols = this.colLabels.length;
    this.activeRegex = this.regexes[this.nCols];
  }

  parse (str) {
    let cols = {};
    for (let i = 0; i < this.nCols; i++) {
      cols[this.colLabels[i]] = [];
    }
    let tempArr;
    while (tempArr = this.activeRegex.exec(str)) {
      for (let i = 0; i < this.nCols; i++) {
        cols[this.colLabels[i]].push(Util.toFloat(tempArr[i + 1]));
      }
    }
    if (cols[this.colLabels[0]].length < 2) {
      alert('Input data could not be parsed! Please use two to four columns matching with your import settings.' +
        'The columns must be separated by tab, comma, colon, semicolon and/or spaces.');
      return;
    }
    return cols;
  }
}

class Util {
  static isSorted (arr) {
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] < arr[i - 1]) {
        return false;
      }
    }
    return true;
  }

  // https://stackoverflow.com/questions/118241/calculate-text-width-with-javascript
  static getTextWidth (text, font) {
    // re-use canvas object for better performance
    var canvas = Util.canvas || (Util.canvas = document.createElement('canvas'));
    var context = canvas.getContext('2d');
    context.font = font;
    var metrics = context.measureText(text);
    return metrics.width;
  }

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

  static tickOrderOfMagnitude (arr) {
    let first = arr[0];
    let last = arr[arr.length - 1];
    let span = Math.abs(last - first);
    let estTickInterval = span / (2 * nTicks);
    return Math.floor(Math.log10(estTickInterval));
  }

  static numIsInteger (num) {
    return num % 1 === 0;
  }

  static appendStrToArr (arr, str) {
    return arr.map(elem => elem + str);
  }

  // https://stackoverflow.com/questions/9895082/javascript-populate-drop-down-list-with-array
  static populateSelectBox (idSelector, optionArray) {
    let box = document.getElementById(idSelector);
    for (let i = 0; i < optionArray.length; i++) {
      let option = optionArray[i];
      let el = document.createElement('option');
      el.textContent = option;
      el.value = option;
      box.appendChild(el);
    }
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

class CurveFitter {
  static initialize () {
    CurveFitter.defaultOptions = {
      damping: 1.5,
      gradientDifference: 10e-2,
      maxIterations: 100,
      errorTolerance: 10e-3
    };

    CurveFitter.xDefaults = {
      'nPoints': 1000,
      'xMargin': 0
    };

    CurveFitter.possibleParams = ['A', 'B', 'C', 'D', 'E', 'F'];
    CurveFitter.renderedParams = [];
    CurveFitter.functionInput = document.getElementById('fitFunction');
    CurveFitter.paramTable = document.getElementById('fitParameterTable');
    CurveFitter.tableBody = CurveFitter.paramTable.getElementsByTagName('tbody')[0];
    CurveFitter.parser = math.parser();
    CurveFitter.renderParameterTable();
    CurveFitter.initFitButton();
    CurveFitter.initFinalizeButton();
    CurveFitter.initXDefaults();
    CurveFitter.initOptions();
  }

  static initXDefaults () {
    document.getElementById('fitNPoints').value = CurveFitter.xDefaults.nPoints;
    document.getElementById('fitXMargin').value = CurveFitter.xDefaults.xMargin;
  }

  static initOptions () {
    document.getElementById('fitDampingParameter').value = CurveFitter.defaultOptions.damping;
    document.getElementById('fitGradientDecrease').value = CurveFitter.defaultOptions.gradientDifference;
    document.getElementById('fitNumIterations').value = CurveFitter.defaultOptions.maxIterations;
    document.getElementById('fitErrorTolerance').value = CurveFitter.defaultOptions.errorTolerance;
  }

  static makeFitX () {
    let trace = CurveFitter.targetTrace;
    if (!trace) {
      return;
    }
    let traceX = trace.xTransformed;

    let xStart = d3.min(traceX);
    let xEnd = d3.max(traceX);
    let xSpan = Math.abs(xEnd - xStart);
    let xMarginFraction = CurveFitter.getFitMargin();
    if (xMarginFraction === null) {
      return null;
    }
    let xMargin = xMarginFraction * xSpan;

    let xPoints = CurveFitter.getFitPoints();
    if (xPoints === null) {
      return null;
    }
    let xStartMargin = xStart - xMargin;
    let xEndMargin = xEnd + xMargin;
    let delta = (xEndMargin - xStartMargin) / (xPoints - 1);
    return d3.range(xPoints).map(function (i) { return xStartMargin + i * delta; });
  }

  static getNumIterations () {
    let numIterationsStr = document.getElementById('fitNumIterations').value;
    let numIterationsInt;
    try {
      numIterationsInt = parseInt(numIterationsStr);
    } catch (err) {
      alert(err.toString());
      return null;
    }
    if (numIterationsInt < 1) {
      alert('Number of iterations per step must be >= 1.');
      return null;
    }
    return numIterationsInt;
  }

  static getGradientDecrease () {
    let gradientDecreaseStr = document.getElementById('fitGradientDecrease').value;
    let gradientDecreaseFloat;
    try {
      gradientDecreaseFloat = Util.toFloat(gradientDecreaseStr);
    } catch (err) {
      alert(err.toString());
      return null;
    }
    if (gradientDecreaseFloat < 0) {
      alert('Gradient decrease parameter cannot be negative.');
      return null;
    }
    return gradientDecreaseFloat;
  }

  static getDampingParameter () {
    let dampingStr = document.getElementById('fitDampingParameter').value;
    let dampingFloat;
    try {
      dampingFloat = Util.toFloat(dampingStr);
    } catch (err) {
      alert(err.toString());
      return null;
    }
    if (dampingFloat < 0) {
      alert('Damping parameter cannot be negative.');
      return null;
    }
    return dampingFloat;
  }

  static getErrorTolerance () {
    let errorTolStr = document.getElementById('fitErrorTolerance').value;
    let errorTolFloat;
    try {
      errorTolFloat = Util.toFloat(errorTolStr);
    } catch (err) {
      alert(err.toString());
      return null;
    }
    if (errorTolFloat < 0) {
      alert('Error tolerance cannot be negative.');
      return null;
    }
    return errorTolFloat;
  }

  static getFitMargin () {
    let marginStr = document.getElementById('fitXMargin').value;
    let marginAbsolute;
    try {
      marginAbsolute = Util.toFloat(marginStr) / 100;
    } catch (err) {
      alert(err.toString());
      return null;
    }
    if (marginAbsolute < 0) {
      alert('Fit margin cannot be negative.');
      return null;
    }
    return marginAbsolute;
  }

  static getFitPoints () {
    let pointsStr = document.getElementById('fitNPoints').value;
    let pointsInt;
    try {
      pointsInt = parseInt(pointsStr);
    } catch (err) {
      alert(err.toString());
      return null;
    }
    if (pointsInt < 2) {
      alert('At least 2 fit points required.');
      return null;
    }
    return pointsInt;
  }

  static paramToIndex (param) {
    return CurveFitter.possibleParams.indexOf(param);
  }

  static get targetTrace () {
    return Sidebar.traceList.activeTrace;
  }

  static initFitButton () {
    document.getElementById('fitButton').addEventListener('click', function () {
      CurveFitter.fit();
    });
  }

  static initFinalizeButton () {
    document.getElementById('finalizeButton').addEventListener('click', function () {
      CurveFitter.exportFittedCurve();
    });
  }

  static exportFittedCurve () {
    if (!CurveFitter.targetTrace) {
      return;
    }
    let params = CurveFitter.getCurrentParameterValues();
    if (params === null) {
      return;
    }
    CurveFitter.parser.clear();
    fig.ax.resetFitGroup();
    let functionStr = CurveFitter.functionInput.value;
    let funcDef = 'f(x) = ' + functionStr;
    for (let i = 0; i < params.length; i++) {
      CurveFitter.parser.set(params[i][0], params[i][1]);
    }
    CurveFitter.parser.eval(funcDef);

    const f = CurveFitter.parser.get('f');
    const x = CurveFitter.makeFitX();
    if (x === null) {
      return;
    }
    const y = x.map(e => f(e));
    let style = Object.assign({}, defaultFitStyle);
    let traceCols = {'x': x, 'y': y};
    let traceLabel = CurveFitter.makeTraceLabel(params, functionStr);
    let newTrace = new Trace(traceCols, style, traceLabel);
    Sidebar.traceList.addTrace(newTrace, '#00ff00');
    Sidebar.resetLimits();
    Sidebar.show();
    Toolbar.show();
    FigureArea.redraw();
  }

  static makeTraceLabel (params, functionStr) {
    let usedParams = CurveFitter.findUsedParameters(functionStr);
    let usedParamsAndValues = [];
    for (let i = 0; i < params.length; i++) {
      if (usedParams.includes(params[i][0])) {
        usedParamsAndValues.push(params[i]);
      }
    }
    let paramsStr = usedParamsAndValues.map(e => e[0] + ': ' + e[1]).join(', ');
    return 'Fit to "' + CurveFitter.targetTrace.traceLabel + '", y=' + functionStr + ', ' + paramsStr;
  }

  static fit () {
    let targetTrace = CurveFitter.targetTrace;
    if (!targetTrace) {
      return;
    }

    let functionStr = CurveFitter.functionInput.value;

    let usedParams = CurveFitter.findUsedParameters(functionStr);
    if (usedParams.length === 0) {
      alert('The fit function contains no free parameters.');
      return;
    }

    let initialGuess = CurveFitter.makeInitialGuess(usedParams);
    if (initialGuess === null) {
      alert('Please give initial values to all parameters.');
      return;
    }

    let errorTolerance = CurveFitter.getErrorTolerance();
    if (errorTolerance === null) {
      return;
    }

    let damping = CurveFitter.getDampingParameter();
    if (damping === null) {
      return;
    }

    let gradientDecrease = CurveFitter.getGradientDecrease();
    if (gradientDecrease === null) {
      return;
    }

    let numIterations = CurveFitter.getNumIterations();
    if (numIterations === null) {
      return;
    }

    let targetX = targetTrace.xTransformed;
    let targetY = targetTrace.yTransformed;

    let targetData = {
      x: targetX,
      y: targetY
    };

    let funcDef = 'f(x) = ' + functionStr;
    CurveFitter.parser.clear();
    CurveFitter.parser.eval(funcDef);

    let fitFunc = function () {
      for (let i = 0; i < usedParams.length; i++) {
        CurveFitter.parser.set(usedParams[i], arguments[0][i]);
      }
      return CurveFitter.parser.get('f');
    };

    let options = Object.assign({}, CurveFitter.defaultOptions);
    options.initialValues = initialGuess;
    options.maxIterations = numIterations;
    options.errorTolerance = errorTolerance;
    options.gradientDifference = gradientDecrease;
    options.damping = damping;

    try {
      let fitResult = curveFit.levenbergMarquardt(targetData, fitFunc, options);
      CurveFitter.updateParams(usedParams, fitResult.parameterValues);
      CurveFitter.drawFittedGraph();
    } catch (err) {
      alert(err.toString());
    }
  }

  static updateParams (paramNames, fittedValues) {
    for (let i = 0; i < paramNames.length; i++) {
      CurveFitter.setParamValue(paramNames[i], fittedValues[i]);
    }
  }

  static makeInitialGuess (usedParams) {
    let values = [];
    for (let i = 0; i < usedParams.length; i++) {
      let param = usedParams[i];
      let value = CurveFitter.paramValue(param);
      if (value === null) {
        return null;
      }
      values.push(value);
    }
    return values;
  }

  static findUsedParameters (funcStr) {
    let usedParams = [];
    for (let i = 0; i < CurveFitter.possibleParams.length; i++) {
      if (funcStr.includes(CurveFitter.possibleParams[i])) {
        usedParams.push(CurveFitter.possibleParams[i]);
      }
    }
    return usedParams;
  }

  static renderParameterTable () {
    for (let i = 0; i < CurveFitter.possibleParams.length; i++) {
      let addedRow = CurveFitter.tableBody.insertRow(i);
      let labelCell = addedRow.insertCell(0);
      let inputCell = addedRow.insertCell(1);
      let paramInput = document.createElement('input');
      paramInput.classList.add('fit-parameter-input');
      paramInput.classList.add('text-input');
      paramInput.value = '1';
      paramInput.addEventListener('change', function (event) {
        try {
          CurveFitter.drawFittedGraph();
        } catch (err) {
          alert(err.toString());
        }
      });
      inputCell.appendChild(paramInput);
      labelCell.textContent = CurveFitter.possibleParams[i] + ':';
    }
  }

  static drawFittedGraph () {
    if (!CurveFitter.targetTrace) {
      return;
    }
    let params = CurveFitter.getCurrentParameterValues();
    if (params === null) {
      return;
    }
    CurveFitter.parser.clear();
    fig.ax.resetFitGroup();
    let functionStr = CurveFitter.functionInput.value;
    let funcDef = 'f(x) = ' + functionStr;
    for (let i = 0; i < params.length; i++) {
      CurveFitter.parser.set(params[i][0], params[i][1]);
    }
    CurveFitter.parser.eval(funcDef);

    const f = CurveFitter.parser.get('f');
    const x = CurveFitter.makeFitX();
    if (x === null) {
      return;
    }
    const y = x.map(e => f(e));
    let style = Object.assign({}, defaultFitStyle);
    let fittedGraph = new Graph(x, y, null, null, style);
    fittedGraph.draw(fig.ax.fitElem, fig.ax.xScale, fig.ax.yScale);
  }

  static paramValue (param) {
    let index = CurveFitter.paramToIndex(param);
    let valueStr = CurveFitter.tableBody.rows[index].cells[1].getElementsByTagName('input')[0].value;
    let valueFloat = 0;
    try {
      valueFloat = Util.toFloat(valueStr);
    } catch (err) {
      return null;
    }
    return valueFloat;
  }

  static setParamValue (param, value) {
    let index = CurveFitter.paramToIndex(param);
    CurveFitter.tableBody.rows[index].cells[1].getElementsByTagName('input')[0].value = value;
  }

  static getCurrentParameterValues () {
    let params = [];
    for (let i = 0; i < CurveFitter.possibleParams.length; i++) {
      let param = CurveFitter.possibleParams[i];
      let valueFloat = CurveFitter.paramValue(param);
      if (valueFloat === null) {
        return null;
      }
      params[i] = [param, valueFloat];
    }
    return params;
  }
}

var fig = new Figure('#figure_area');
Toolbar.initialize();
Sidebar.initialize();
FigureArea.initialize();
CurveFitter.initialize();

window.onbeforeunload = function (event) {
  event.preventDefault();
};
