// https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/File_drag_and_drop
function dropHandler (ev) {
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

function dragOverHandler (ev) {
  ev.stopPropagation();
  ev.preventDefault();
}

function removeDragData (ev) {
  if (ev.dataTransfer.items) {
    ev.dataTransfer.items.clear();
  } else {
    ev.dataTransfer.clearData();
  }
}

// https://www.html5rocks.com/en/tutorials/file/dndfiles/
function fileHandler (file) {
  var reader = new FileReader();
  reader.onload = (function (dataFile) {
    return function (e) {
      parseAndPlot(e.target.result, file.name);
    };
  })();
  reader.readAsText(file);
}

function parseAndPlot (str, fileName) {
  var xy = regexParse(str);
  saveTempData(xy, fileName);
  resetLimits();
  redraw();
  hideInstruction();
  showToolbar();
}

function hideInstruction () {
  var instruction = document.getElementById('instruction_text');
  instruction.style.display = 'none';
  document.getElementById('figure_area').style.borderStyle = 'hidden';
}

function showToolbar () {
  document.getElementById('toolbar').style.display = 'block';
}

// https://stackoverflow.com/questions/2176861/javascript-get-clipboard-data-on-paste-event-cross-browser
function readPasteAndPlot (e) {
  var clipboardData, pastedData;
  var fileName = 'pasted_data';

  e.stopPropagation();
  e.preventDefault();

  clipboardData = e.clipboardData || window.clipboardData;
  pastedData = clipboardData.getData('Text');
  parseAndPlot(pastedData, fileName);
}

function saveTempData (xy, fileName) {
  xyG = xy;
  fileNameG = fileName;
}

function regexParse (str) {
  var rowRe = /^\s*([+-]?[0-9]+(\.|,)?[0-9]*([eE][-+]?[0-9]+)?)(\t|,|[\s]+)\s?([+-]?[0-9]+(\.|,)?[0-9]*([eE][-+]?[0-9]+)?)\s?$/mg;
  var arr;
  var x = [];
  var y = [];
  while (arr = rowRe.exec(str)) {
    x.push(toFloat(arr[1]));
    y.push(toFloat(arr[5]));
  }
  return [x, y];
}

function downloadSVG () {
  var svgFileName = getFileName() + '.svg';
  var svgUrl = getSvgUrl();
  var downloadLink = document.createElement('a');
  downloadLink.href = svgUrl;
  downloadLink.download = svgFileName;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

function downloadPNG () {
  var pngFileName = getFileName() + '.png';
  var svgUrl = getSvgUrl();
  var svg = getSvgFigure();
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

function getSvgUrl () {
  // get svg element.
  var svg = getSvgFigure();

  // get svg source.
  var serializer = new XMLSerializer();
  var source = serializer.serializeToString(svg);

  // add name spaces.
  if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!source.match(/^<svg[^>]+"http:\/\/www\.w3\.org\/1999\/xlink"/)) {
    source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  }

  // add xml declaration
  source = '<?xml version="1.0" standalone="no"?>\r\n' + source;

  // convert svg source to URI data scheme.
  var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
  return url;
}