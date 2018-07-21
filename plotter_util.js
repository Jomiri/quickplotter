function toPercentWidth (intStrokeWidth) {
  return 0.1 * intStrokeWidth + '%';
}


function pxToSvgPercentage (pxSize) {
  var diagonalLength = getFigAreaDiagonal();
  return Math.floor(pxSize / diagonalLength) * 100;
}

function getViewPortDiagonal () {
  var svg = getSvgFigure();
  var box = svg.viewBox.baseVal;
  return Math.sqrt(box.width * box.width + box.height * box.height);
}

function getSvgFigure () {
  return document.getElementById('figure');
}

// Helper funcs

function getFigAreaDiagonal () {
  var size = figAreaSize();
  return Math.sqrt(size.width * size.width + size.height * size.height);
}

function toFloat (numStr) {
  return parseFloat(numStr.replace(/,/, '.'));
}

function getFileName () {
  return document.getElementById('figure').dataset.filename;
}

function formatPrecision (num) {
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
  /*
  var precision = 1;
  if (orderOfMagn < 1) {
    precision = Math.abs(orderOfMagn);
  } else if (orderOfMagn < 4) {
    precision = 3 - orderOfMagn;
  } else {
    precision = 0;
  }
  return precision;
  */
}


function stripFileExtension (fileName) {
  // https://stackoverflow.com/questions/4250364/how-to-trim-a-file-extension-from-a-string-in-javascript
  return fileName.replace(/\.[^/.]+$/, '');
}

function getSpan (arr) {
  return Math.abs(d3.max(arr) - d3.min(arr));
}

function orderOfMagnitude (arr) {
  return Math.floor(Math.log10(Math.max(Math.abs(arr[0]), Math.abs(arr[arr.length - 1]))));
}

function numIsInteger (num) {
  return num % 1 === 0;
}

function appendStrtoArr (arr, str) {
  var output = [];
  for (var i = 0; i < arr.length; i++) {
    output.push(arr[i] + str);
  }
  return output;
}

// https://stackoverflow.com/questions/9895082/javascript-populate-drop-down-list-with-array
function populateSelectBox (idSelector, optionArray) {
  var box = document.getElementById(idSelector);
  for (var i = 0; i < optionArray.length; i++) {
    var option = optionArray[i];
    var el = document.createElement('option');
    el.textContent = option;
    el.value = option;
    box.appendChild(el);
  }
}

function scaleArray (arr, multiplier) {
  for (var i = 0; i < arr.length; i++) {
    arr[i] *= multiplier;
  }
}