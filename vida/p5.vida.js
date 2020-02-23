
p5.prototype.VidaBlob = function(_sketch) {
  /*
    A "private" variable that intercepts the "handle" of a sketch that manages
    an object created based on the Vida pseudo-class.
  */
  this.__sketch = _sketch;
  /*
    Normalized coordinates of the rectangle in which the blob is contained
    (bounding box).
  */
  this.normRectX = 0.0; this.normRectY = 0.0;
  this.normRectW = 0.0; this.normRectH = 0.0;
  /*
    Normalized parameters of the blob's "mass". The "mass" is calculated based
    on the ratio of the number of pixels occupied by the blob to the number of
    pixels in the image being processed. The mass center is calculated based on
    the average position of the pixels that make up the blob.
  */
  this.normMassCenterX = 0.0; this.normMassCenterY = 0.0; this.normMass = 0.0;
  /*
    An array storing the normalized coordinates of the approximate polygon
    describing the blob.
  */
  this.approximatedPolygon = []; // format: {normX: float, normY: float}
  /*
    Detection time of the blob expressed in milliseconds and frames.
  */
  this.creationTime = this.__sketch.millis();
  this.creationFrameCount = this.__sketch.frameCount;
  /*
    The unique identifier (integer) of the blob. If blob tracking is also
    included in addition to the detection of blobs, VIDA will try to recognize
    the blobs in subsequent frames and give them the same identifiers.
  */
  this.id = -1;
  /*
    A "private" variable that stores the original blob identifier assigned to
    it by the detection mechanism. This is the identifier given to the blob
    just after detection, before the mechanisms that track and filter out the
    blobs that do not meet the set parameters  (VIDA can, among others, filter
    out too small or too large blobs, reject - or prefer - blobs containing
    larger ones).
  */
  this.__rawId = -1;
  /*
    The flag whose value will be "true" if the blob is considered new (as a
    result of blob tracking mechanism). Otherwise, the flag will be set to
    "false".
  */
  this.isNewFlag = true;
}

/*
  Container used to store active zone data. Active zone is a rectangular area
  of the processed image, treated as a sensor: if there is movement within it
  VIDA will record this in the adequate parameters of the object describing the
  given zone and will call a defined function reacting to the change of the
  state of the zone (passing the object describing the zone as a parameter).
*/
p5.prototype.VidaActiveZone = function(
  _id, _normX, _normY, _normW, _normH, _onChangeCallbackFunction
) {
  /*
    Normalized coordinates of the rectangle in which active zone is contained
    (bounding box).
  */
  this.normX = _normX; this.normY = _normY;
  this.normW = _normW; this.normH = _normH;
  /*
    If you want to disable the processing of a given active zone without
    removing it, this variable will definitely be useful to you. If it's value
    is "true", the zone will be tested, if the variable value is "false", the
    zone will not be tested.
  */
  this.isEnabledFlag = true;
  /*
    The value of this flag will be "true" if motion is detected within the
    zone. Otherwise, the flag value will be "false".
  */
  this.isMovementDetectedFlag = false;
  /*
    This flag will be set to "true" if the status (value of
    this.isMovementDetectedFlag) of the zone has changed in the current frame.
    Otherwise, the flag value will be "false".
  */
  this.isChangedFlag = false;
  /*
    The moment - expressed in milliseconds and frames - in which the zone has
    recently changed it's status (value of this.isMovementDetectedFlag).
  */
  this.changedTime = 0; this.changedFrameCount = 0;
  /*
    The ratio of the area of the zone in which movement was detected to the
    whole surface of the zone.
  */
  this.normFillFactor = 0.0;
  /*
    Normalized value - ratio of the area of the zone in which movement was
    detected to the total area of the zone - required to be considered that
    there was a movement detected in the zone.
  */
  this.normFillThreshold = 0.02;
  /*
    Zone identifier. It can have a numeric form (integer will be more reliable
    than floats) or can be a text string (eg "zone1" or "activeZoneX").
    If you create multiple zones their identifiers do not have to be unique,
    however, because of the ease of management zones, distinguishing them from
    each other and editing to better it was.
  */
  this.id = _id;
  /*
    A function that will be called when the zone changes status (when value of
    this.isMovementDetectedFlag will be changed). The object describing the
    current zone will be passed to the function as a parameter. If you create
    multiple zones, you can (depending on the preferences and the specificity
    of the project) define separate callback functions for them or use one.
  */
  this.onChange = _onChangeCallbackFunction;
}

/*
  Main VIDA pseudoclass. One parameter ("_sketch") should be passed to the
  constructor: the "handle" of a sketch that manages an object created based on
  the Vida pseudo-class.
*/
p5.prototype.Vida = function(_sketch) {
  /*
    A "private" variable that intercepts the "handle" of a sketch that manages
    an object created based on the Vida pseudo-class.
  */
  this.__sketch = _sketch;
  /* 
    Sometimes, especially if the video source is a camera it will be useful to
    be able to flip the image. Usually, a simple horizontal inversion is what
    you need, but in some cases, vertical inversion or a combination of both of
    them may also be considered.
  */
  this.MIRROR_NONE = 0;       // pseudo-constant
  this.MIRROR_VERTICAL = 1;   // pseudo-constant
  this.MIRROR_HORIZONTAL = 2; // pseudo-constant
  this.MIRROR_BOTH = 3;       // pseudo-constant
  this.mirror = this.MIRROR_NONE;
  /*
    This flag allows you to select the progressive background detection mode
    (if the variable value is "true") or non-progressive mode (if the variable
    value is "false"). Progressive mode is based on calculating the background
    image using a feedback loop. Each of the color components of the background
    image is calculated from the formula:
      val = input * (1 - feedback) + val * feedback
    When the non-progressive mode is enabled the background is defined by a
    single image frame, captured and stored in the buffer.
  */
  this.progressiveBackgroundFlag = true;
  /*
    Buffers storing subsequent stages of the processed image. The buffer
    resolution will be automatically adjusted to the current parameters of the
    image being processed:
      this.currentImage - copy of the oryginal image (flipped
        horizontally/vertically if needed);
      this.backgroundImage - static or progressive background image;
      this.differenceImage - absolute value of the difference between the
        background and current image.
      this.thresholdImage - discretised resultant image; values below the set
        threshold are set to 0, above set to 255
  */
  this.currentImage    = this.__sketch.createGraphics(10, 10);
  this.backgroundImage = this.__sketch.createImage(10, 10);
  this.differenceImage = this.__sketch.createImage(10, 10);
  this.thresholdImage  = this.__sketch.createImage(10, 10);
  /*
    The value of the feedback for the procedure that calculates the background
    image in progressive mode. The value should be in the range from 0.0 to 1.0
    (float). Typical values of this variable are in the range between ~0.9 and
    ~0.98.
  */
  this.imageFilterFeedback = 0.92;
  /*
    The value of the threshold for the procedure that calculates the threshold
    image. The value should be in the range from 0.0 to 1.0 (float).
  */
  this.imageFilterThreshold = 0.4;
  /*
    If this flag is set to "true". VIDA will call loadPixels and updatePixels
    functions for processed images. It's a "private" variable.
  */
  this.__automaticPixelsDataTransferFlag = true;
  /*
    The time of the last update of the VIDA object. Variables store the frame
    count and time in milliseconds.
  */
  this.lastUpdateTime = 0; this.lastUpdateFrameCount = 0;
  /*
    A "private" variable storing value used as default for normFillThreshold
    attribute of newly created active zones.
  */
  this.__activeZonesNormFillThreshold = 0.02;
  /*
    If this flag is set to "true", VIDA will check if there has been movement
    detected in the defined active zones. If the flag is set to "false" all
    defined active zones are ignored.
  */
  this.handleActiveZonesFlag = false;
  /*
    The array that stores active zones.
  */
  this.activeZones = [];
  /*
    Two "private" variables storing the addresses of the current and previous
    set of blobs in the this.__blobs array. Previous blobs are needed for a
    procedure trying to keep the same identifiers to blobs that seem to be a
    continuation of the previous generation's blobs.
  */
  this.__currentBlobsLocation = 0; this.__previousBlobsLocation = 1;
  /*
    An "private" array storing the current and previous congregation of
    detected blobs.
  */
  this.__blobs = [[],[]];
  /*
    If this flag is set to "true", VIDA will look for moving objects (blobs) in
    the monitored image. If the flag is set to "false" VIDA will not search for
    blobs.
  */
  this.handleBlobsFlag = false;
  /*
    A set of pseudo-constants and variable controlling the blobs filtering
    mechanism due to their position and size. VIDA may prefer smaller blobs
    located inside larger or the opposite: reject smaller blobs inside larger
    ones. The mechanism can also be completely disabled. The mechanism works on
    the basis of data describing the rectangles in which the detected blobs are
    located.
  */
  this.REJECT_NONE_BLOBS = 0;  // pseudo-constant
  this.REJECT_INNER_BLOBS = 1; // pseudo-constant
  this.REJECT_OUTER_BLOBS = 2; // pseudo-constant
  this.rejectBlobsMethod = this.REJECT_NONE_BLOBS;
  /*
    If this flag is set to "true", VIDA will try to maintain permanent
    identifiers of detected blobs that seem to be a continuation of the
    movement of objects detected earlier - this prevents random changes of
    identifiers when changing the number and location of detected blobs.
  */
  this.trackBlobsFlag = false;
  /*
    Normalized value of the distance between the tested blobs of the current
    and previous generation, which allows treating the new blob as the
    continuation of the "elder".
  */
  this.trackBlobsMaxNormDist = 0.15;
  /*
    Normalized values of parameters defining the smallest and highest allowable
    mass of the blob.
  */
  this.normMinBlobMass = 0.0002; this.normMaxBlobMass = 0.5;
  /*
    Normalized values of parameters defining the smallest and highest allowable
    area (of the bounding box) of the blob.
  */
  this.normMinBlobArea = 0.0002; this.normMaxBlobArea = 0.5;
  /*
    If this flag is set to "true", VIDA will generate polygons that correspond
    approximately to the shape of the blob. If this flag is set to "false", the
    polygons will not be generated.
  */
  this.approximateBlobPolygonsFlag = false;
  /*
    Variable (integer) that stores the value corresponding to the number of
    polygon points describing the shape of the blobs. The minimum value of this
    variable is 3.
  */
  this.pointsPerApproximatedBlobPolygon = 6;
  /*
    A private variable that stores the current data used by the blob detection
    procedure.
  */
  this.__blobMapArray = [];
  /*
    Number of blobs detected (after filtering out those you want to get rid
    of).
  */
  this.numberOfDetectedBlobs = 0;
  /*
    Let's set the size of the this.__blobMapArray to the corresponding with
    image being processed.
  */
  this.resizeBlobMapArray(
    this.thresholdImage.width, this.thresholdImage.height
  );
}

// p5js bug (?) workaround
p5.prototype.Vida.prototype.resizeGraphicsWorkaround = function(_g, _w, _h) {
  if(_g === null || _g === undefined) {
    _g = this.__sketch.createGraphics(_w, _h);
    _g.pixelDensity(1);
  }
  else {
    _g.width = _w;
    _g.height = _h;
    _g.elt.width = _w;// * this._pInst._pixelDensity;
    _g.elt.height = _h;// * this._pInst._pixelDensity;
    _g.elt.style.width = _w + 'px';
    _g.elt.style.height = _h + 'px';
    /*
    if (this._isMainCanvas) {
      this._pInst._setProperty('width', this.width);
      this._pInst._setProperty('height', this.height);
    }*/
    //_g.remove();
    //_g = null;
    //_g = this.__sketch.createGraphics(_w, _h); // ugly!
    //_g.width = _w; _g.height = _h;
    //_g.size(_w, _h);
    //_g.elt.setAttribute('style', 'width:' + _w + 'px; height:' + _h + 'px');
    //_g.elt.style.width = _w +'px'; _g.elt.style.height = _h + 'px';
    //_g.resize(_w, _h);
    _g.pixelDensity(1);
    _g.loadPixels(); // console.log(_g.width);
    //_g.elt.style.width = _w +'px'; _g.elt.style.height = _h + 'px';
    _g.elt.setAttribute('style', 'display: none');
  }
  _g.updatePixels();
  _g.background(0);
  _g.loadPixels();
  if(_w * _h !== _g.pixels.length / 4) {
    console.log(
      '[Vida, resizeGraphicsWorkaround] _w * _h !== _g.pixels.length / 4:' +
      '\n_w = ' + _w + ' _h = ' + _h +
      '\n_g.width = ' + _g.width + ' _g.height = ' + _g.height +
      '\n_w * _h = ' + (_w * _h) +
      '\n_g.pixels.length / 4 = ' + (_g.pixels.length / 4)
    );
  }
}

/*
  This function returns current or previous set of detected blobs. It is a
  safer solution than direct access to the "private" variable when reading
  value from the code outside the VIDA library. The function called without a
  parameter returns a buffer with the current blobs.
*/
p5.prototype.Vida.prototype.getBlobs = function(_location) {
  if(arguments.length === 0) _location = this.__currentBlobsLocation;
  else
    if(
      _location !== this.__currentBlobsLocation &&
      _location !== this.__previousBlobsLocation
    ) {
      console.log(
        '[Vida, getBlobs] Unhandled _location parameter value: ' +
        _location + '. The _location value will be change to ' +
        this.__currentBlobsLocation + ' (' + this.__currentBlobsLocation + ').'
      );
      _location = this.__currentBlobsLocation;
    }
  return this.__blobs[_location];
}

/*
  This function returns this.__currentBlobsLocation value. It is a safer
  solution than direct access to the "private" variable when reading value from
  the code outside the VIDA library. Returns integer (0 or 1).
*/
p5.prototype.Vida.prototype.getCurrentBlobsLocation = function() {
  return this.__currentBlobsLocation;
}

/*
  This function returns this.__previousBlobsLocation value. Similar to the
  previous function, it is a safer solution than direct access to the "private"
  variable when reading value from the code outside the VIDA library. Returns
  integer (0 or 1).
*/
p5.prototype.Vida.prototype.getPreviousBlobsLocation = function() {
  return this.__previousBlobsLocation;
}

/*
  This function changes the size of the this.__blobMapArray array according to
  the given parameters. Variable this.__blobMapArray is a two-dimensional array
  (array of arrays), because it operates on data generated on the image base.
  After changing the table size, the function initializes all cells (gives them
  a value of 0).
*/
p5.prototype.Vida.prototype.resizeBlobMapArray = function(
  _w, _h
) {
    this.__blobMapArray.splice(0, this.__blobMapArray.length);
    for(var x = 0; x < _w; x++) {
      var temp_column_array = [];
      for(var y = 0; y < _h; y++) temp_column_array[y] = 0;
      this.__blobMapArray[x] = temp_column_array;
    }
}

/*
  This function (re)initializes all cells of the this.__blobMapArray array
  (gives them a value of 0).
*/
p5.prototype.Vida.prototype.resetBlobMapArray = function() {
  for(var y = 0; y < this.thresholdImage.height; y++)
      for(var x = 0; x < this.thresholdImage.width; x++)
        this.__blobMapArray[x][y] = 0;
}

/*
  A function that tests whether a point with indicated normalized coordinates
  is located over the area in which movement was detected. Returns "true" if
  yes, otherwise returns "false".
*/
p5.prototype.Vida.prototype.hitTestThresholdImage = function(
  _norm_x, _norm_y
) {
  // convert coords to pixel-based
  var temp_coord_x = Math.floor(_norm_x * this.thresholdImage.width);
  var temp_coord_y = Math.floor(_norm_y * this.thresholdImage.height);
  // test these conditions to prevent possible problems if coords are out of
  // range
  if(temp_coord_x < 0.0) return false;
  if(temp_coord_y < 0.0) return false;
  if(temp_coord_x >= this.thresholdImage.width) return false;
  if(temp_coord_y >= this.thresholdImage.height) return false;
  /*
    Convert coords to the position in the this.thresholdImage.pixels[array].
    Pixels array is one-dimentional and contains 4 cells per pixel (to store
    RGBA components).
  */
  var temp_pixel_position =
    (temp_coord_y * this.thresholdImage.width + temp_coord_x) * 4;
  // check if the pixel contains information on detected movement.
  if(this.thresholdImage.pixels[temp_pixel_position] > 0) return true;
  return false;
}

/*
  This function changes the this.__activeZonesNormFillThreshold value and
  applies this value to all active zones already created. The parameter passed
  to the function should be in the range between 0.0 and 1.0 (float). Zones
  created after calling this function inherit the new value assigned to the
  variable. However, you can also set individual threshold values for one or
  more zones by accessing them and modyfing normFillThreshold value manually.
*/
p5.prototype.Vida.prototype.setActiveZonesNormFillThreshold = function(
  _v // new threshold value
) {
  if(_v < 0.0) _v = 0.0; if(_v > 1.0) _v = 1.0; // safety first
  this.__activeZonesNormFillThreshold = _v; // momorize new threshold value
  // assigning a new threshold value to all existing active zones
  for(var i = 0; i < this.activeZones.length; i++)
    this.activeZones[i].normFillThreshold =
      this.__activeZonesNormFillThreshold;
}

/*
  Function returns current value of the this.__activeZonesNormFillThreshold
  "private" variable.
*/
p5.prototype.Vida.prototype.getActiveZonesNormFillThreshold = function() {
  return this.__activeZonesNormFillThreshold;
}

/*
  A wrapper function that simplifies the placement of new active zones.
  In this version (in contrast to the functions above), the function also
  allows you to define the function called when the zone changes status.
*/
p5.prototype.Vida.prototype.addActiveZone = function(
  _id, // zone's identifier (integer or string)
  _normX, _normY, _normW, _normH, // normalized rectangle
  _onChangeCallbackFunction // callback function
) {
  /*
    Thanks of this condition we can use this function with shorter or longer
    list of paramewters.
  */
  if(arguments.length === 5) {
    _onChangeCallbackFunction = function(_activeZone) {};
  }
  for(var i = 0; i < this.activeZones.length; i++)
    if(_id == this.activeZones[i].id)
      console.log(
        '[Vida, addActiveZone] There are already active zones with the same' +
        ' id: ' + _id
      );
  if(
    _onChangeCallbackFunction === null ||
    _onChangeCallbackFunction === undefined
  ) _onChangeCallbackFunction = function(_activeZone) {};
  this.activeZones[this.activeZones.length] =
    new this.__sketch.VidaActiveZone(
      _id, _normX, _normY, _normW, _normH, _onChangeCallbackFunction
    );
}

/*
  Simple function drawing blobs.
*/
p5.prototype.Vida.prototype.drawBlobs = function(
  _x, _y, // pixel based coordinates of the left upper corner of the drawing
  _w, _h // width and height of the drawing expressed in pixels
) {
  /*
    Thanks of this condition we can use this function with shorter or longer
    list of paramewters.
  */
  if(arguments.length === 2) {
    _w = this.thresholdImage.width; _h = this.thresholdImage.height;
  }
  // some reusable variables we need
  var temp_rect_x, temp_rect_y, temp_rect_w, temp_rect_h,
      temp_mass_center_x, temp_mass_center_y;
      this.__sketch.push(); // store current drawing style and font
      this.__sketch.translate(_x, _y); // translate coords
  // set text style and font
  this.__sketch.textFont('Helvetica', 10);
  this.__sketch.textAlign(this.__sketch.LEFT, this.__sketch.BOTTOM);
  this.__sketch.textStyle(this.__sketch.NORMAL);
  // let's iterate over all blobs
  for(var i = 0; i < this.__blobs[this.__currentBlobsLocation].length; i++) {
    // convert norm coords to pixel-based
    temp_rect_x =
      Math.floor(this.__blobs[this.__currentBlobsLocation][i].normRectX * _w);
    temp_rect_y =
      Math.floor(this.__blobs[this.__currentBlobsLocation][i].normRectY * _h);
    temp_rect_w =
      Math.floor(this.__blobs[this.__currentBlobsLocation][i].normRectW * _w);
    temp_rect_h =
      Math.floor(this.__blobs[this.__currentBlobsLocation][i].normRectH * _h);
    temp_mass_center_x =
      Math.floor(
        this.__blobs[this.__currentBlobsLocation][i].normMassCenterX * _w
      );
    temp_mass_center_y =
      Math.floor(
        this.__blobs[this.__currentBlobsLocation][i].normMassCenterY * _h
      );
    // draw bounding box
    this.__sketch.strokeWeight(1);
    this.__sketch.stroke(255, 255, 0);
    this.__sketch.noFill();
    this.__sketch.rect(temp_rect_x, temp_rect_y, temp_rect_w, temp_rect_h);
    // draw mass center
    this.__sketch.noStroke();
    this.__sketch.fill(255, 0 , 0);
    this.__sketch.ellipseMode(this.__sketch.CENTER);
    this.__sketch.ellipse(temp_mass_center_x, temp_mass_center_y, 3, 3);
    // print id
    this.__sketch.noStroke();
    this.__sketch.fill(255, 255 , 0);
    this.__sketch.text(
      this.__blobs[this.__currentBlobsLocation][i].id,
      temp_rect_x, temp_rect_y - 1
    );
    // draw approximated polygon (if available)
    this.__sketch.strokeWeight(1);
    this.__sketch.stroke(255, 0, 0);
    this.__sketch.noFill();
    this.__sketch.beginShape();
    for(
      var j = 0;
      j < this.__blobs[this.__currentBlobsLocation][i].approximatedPolygon.length;
      j++
    ) {
      this.__sketch.vertex(
        this.__blobs[this.__currentBlobsLocation][i].
          approximatedPolygon[j].normX *
        _w,
        this.__blobs[this.__currentBlobsLocation][i].
          approximatedPolygon[j].normY *
        _h,
      );
    }
    this.__sketch.endShape(this.__sketch.CLOSE);
  }
  this.__sketch.pop(); // restore drawing style and font
}

/*
  Simple function drawing active zones.
*/
p5.prototype.Vida.prototype.drawActiveZones = function(_x, _y, _w, _h) {
  /*
    Thanks of this condition we can use this function with shorter or longer
    list of paramewters.
  */
  if(arguments.length === 2) {
    _w = this.thresholdImage.width; _h = this.thresholdImage.height;
  }
  // some reusable variables we need
  var temp_coord_x, temp_coord_y, temp_coord_w, temp_coord_h;
  // store current drawing style and font
  this.__sketch.push();
  // set text style and font
  this.__sketch.textFont('Helvetica', 10);
  this.__sketch.textAlign(this.__sketch.LEFT, this.__sketch.BOTTOM);
  this.__sketch.textStyle(this.__sketch.NORMAL);
  // let's iterate over all active zones
  for(var i = 0; i < this.activeZones.length; i++) {
    // convert norm coords to pixel-based
    temp_coord_x =
      Math.floor(_x + this.activeZones[i].normX * _w);
    temp_coord_y =
      Math.floor(_y + this.activeZones[i].normY * _h);
    temp_coord_w =
      Math.floor(this.activeZones[i].normW * _w);
    temp_coord_h =
      Math.floor(this.activeZones[i].normH * _h);
    // draw zone rect (filled if movement detected)
    this.__sketch.strokeWeight(1);
    if(this.activeZones[i].isEnabledFlag) {
      this.__sketch.stroke(255, 0, 0);
      if(this.activeZones[i].isMovementDetectedFlag)
        this.__sketch.fill(255, 0, 0, 128);
      else
        this.__sketch.noFill();
    }
    else {
      this.__sketch.stroke(0, 0, 255);
      /*
        Theoretically, movement should not be detected within the excluded
        zone, but VIDA is still in the testing phase, so this line will be
        useful for testing purposes.
      */
      if(this.activeZones[i].isMovementDetectedFlag)
        this.__sketch.fill(0, 0, 255, 128);
      else
        this.__sketch.noFill();
    }
    this.__sketch.rect(temp_coord_x, temp_coord_y, temp_coord_w, temp_coord_h);
    // print id
    this.__sketch.noStroke();
    if(this.activeZones[i].isEnabledFlag)
      this.__sketch.fill(255, 0, 0);
    else
      this.__sketch.fill(0, 0, 255);
      this.__sketch.text(
        this.activeZones[i].id, temp_coord_x, temp_coord_y - 1
      );
  }
  // restore drawing style and font
  this.__sketch.pop();
}

/*
  The function enables deleting active zones from the this.activeZones array.
  The function deletes all zones with the indicated identifier from the array.
*/
p5.prototype.Vida.prototype.removeActiveZone = function(_id) {
  for(var i = this.activeZones.length - 1; i >= 0; i--) {
    if(_id == this.activeZones[i].id) list.splice(i, 1);
  }
}

/*
  This function returns index of the active zone with specified identifier. If
  there is more than one zone with specified identifier in the table, the
  function will return the index of the first active zone. If the zone with the
  indicated identifier does not exist, the function returns -1.
*/
p5.prototype.Vida.prototype.getActiveZone = function(_id) {
  for(var i = 0; i < this.activeZones.length; i++) {
    if(_id == this.activeZones[i].id) return this.activeZones[i];
  }
  return -1;
}

/*
  A function that updates statuses of defined and enabled active zones.
*/
p5.prototype.Vida.prototype.updateActiveZones = function() {
  // some reusable variables we need
  var temp_coord_start_x, temp_coord_start_y,
      temp_coord_end_x, temp_coord_end_y,
      temp_pixel_position, temp_number_of_filled_pixels, temp_zone_area,
      temp_isMovementDetectedFlag;
  // let's iterate over all active zones
  for(var i = 0; i < this.activeZones.length; i++) {
    // reset and bypass disabled zones
    if(!this.activeZones[i].isEnabledFlag) {
      this.activeZones[i].isChangedFlag = false;
      this.activeZones[i].isMovementDetectedFlag = false;
      continue;
    }
    // convert normalized coords of the zone to pixel-based
    temp_coord_start_x =
      Math.floor(this.activeZones[i].normX * this.thresholdImage.width);
    temp_coord_start_y =
      Math.floor(this.activeZones[i].normY * this.thresholdImage.height);
    temp_coord_end_x =
      Math.floor(
        (this.activeZones[i].normX + this.activeZones[i].normW) *
        this.thresholdImage.width
      );
    temp_coord_end_y =
      Math.floor(
        (this.activeZones[i].normY + this.activeZones[i].normH) *
        this.thresholdImage.height
      );
    temp_zone_area =
      Math.floor(
        this.activeZones[i].normW * this.thresholdImage.width) +
        Math.floor(this.activeZones[i].normH * this.thresholdImage.height
      );
    // count number of filled pixels inside the zone
    temp_number_of_filled_pixels = 0; // reset the variable
    for(var y = temp_coord_start_y; y <= temp_coord_end_y; y++) {
      for(var x = temp_coord_start_x; x <= temp_coord_end_x; x++) {
        temp_pixel_position = (y * this.thresholdImage.width + x) * 4;
        if(this.thresholdImage.pixels[temp_pixel_position] > 0)
          temp_number_of_filled_pixels += 1;
      }
    }
    // calculate normalized fill factor
    this.activeZones[i].normFillFactor =
      temp_number_of_filled_pixels / temp_zone_area;
    /* 
      Check if the fill factor is higher or lower than the threshold. Values
      above the threshold obviously mean the detection of movement in the zone.
    */
    if(
      this.activeZones[i].normFillFactor >
      this.activeZones[i].normFillThreshold
    )
      temp_isMovementDetectedFlag = true;
    else
      temp_isMovementDetectedFlag = false;
    // update the zone data if needed
    if(
      temp_isMovementDetectedFlag != this.activeZones[i].isMovementDetectedFlag
    ) {
      this.activeZones[i].isChangedFlag = true;
      this.activeZones[i].changedTime = this.__sketch.millis();
      this.activeZones[i].changedFrameCount = this.__sketch.frameCount;
      this.activeZones[i].isMovementDetectedFlag = temp_isMovementDetectedFlag;
      // execute callback function
      this.activeZones[i].onChange(this.activeZones[i]);
    }
  }
}

/*
  A function that updates the state of the image processor, zones and blob
  detector. It is usually called once in each repetition of the draw loop. The
  function requires passing one parameter: an object containing an image to
  process (typically captured from video camera or from video file, but you can
  use any graphic data converted to the p5.Image format).
*/
p5.prototype.Vida.prototype.update = function(_image) {
  if(this.updateImageProcessor(_image)) {
    if(this.handleActiveZonesFlag) this.updateActiveZones();
    if(this.handleBlobsFlag) this.updateBlobs();
    // update variables storing update timetag
    this.lastUpdateTime = this.__sketch.millis();
    this.lastUpdateFrameCount = this.__sketch.frameCount;
  }
  else {
    console.log(
      '[Vida, update] something went wrong. Probably the ' +
      'updateImageProcessor function call failed.'
    );
  }
}

/*
  The function allows manual setting of the image representing the background.
  Used when non-progressive background mode is set. The function requires
  passing one parameter: an object containing an image to process (typically
  captured from video camera or from video file, but you can use any graphic
  data converted to the p5.Image format).
*/
p5.prototype.Vida.prototype.setBackgroundImage = function(_image) {
  // check for typically corrupted data
  if(_image === null) {
    console.log('[Vida, setBackgroundImage] error: _image === null');
    return false;
  }
  if(_image.width < 1 || _image.height < 1) {
    console.log(
      '[Vida, setBackgroundImage] possible error: resolution of the _image ' +
      'seems to be incorrect: _image.width = ' + _image.width +
      ' _image.height = ' + _image.height + '.'
    );
    return false;
  }
  /*
    If resolution of the _image is different to the current background image
    VIDA will resize all internal images and the __blobMapArray to meet changed
    requirements.
  */
  if(
    _image.width != this.backgroundImage.width ||
    _image.height != this.backgroundImage.height
  ) {
    console.log(
      '[Vida, setBackgroundImage] adjusting images size to: ' +
      _image.width + ' ' + _image.height
    );
    this.resizeGraphicsWorkaround(
      this.currentImage, _image.width, _image.height
    );
    this.backgroundImage.resize(_image.width, _image.height);
    this.differenceImage.resize(_image.width, _image.height);
    this.thresholdImage.resize(_image.width, _image.height);
    this.resizeBlobMapArray(_image.width, _image.height);
  }
  // load pixels data if needed
  if(this.__automaticPixelsDataTransferFlag) {
    _image.loadPixels();
    this.backgroundImage.loadPixels();
    this.differenceImage.loadPixels();
  }
  /*
    Copy pixel data from _image to this.backgroundImage. If necessary, we will
    invert the image vertically / horizontally - we will use for this purpose
    this.currentImage as a temporary buffer (theoretically not very elegant,
    but probably it should not cause problems). We handle mirroring thanks to
    the use of built-in p5js graphics capabilities: the image passed to the
    function as a parameter is copied to the internal VIDA buffer (this buffer
    - stored in this.currentImage - is the p5.Graphics object) using the
    possibilities offered by vertical and horizontal scaling to flip the image
    in the selected axis (or axes).
  */
  switch(this.mirror) {
    case this.MIRROR_NONE:
      this.backgroundImage.copy(
        _image,
        0, 0, _image.width, _image.height, 0, 0, _image.width, _image.height
      );
    break;
    case this.MIRROR_HORIZONTAL:
      this.currentImage.push();
        this.currentImage.scale(-1, 1);
        this.currentImage.image(_image, -this.currentImage.width, 0);
      this.currentImage.pop();
      this.backgroundImage.copy(
        this.currentImage,
        0, 0, _image.width, _image.height, 0, 0, _image.width, _image.height
      );
    break;
    case this.MIRROR_VERTICAL:
      this.currentImage.push();
        this.currentImage.scale(1, -1);
        this.currentImage.image(_image, 0, -this.currentImage.height);
      this.currentImage.pop();
      this.backgroundImage.copy(
        this.currentImage,
        0, 0, _image.width, _image.height, 0, 0, _image.width, _image.height
      );
    break;
    case this.MIRROR_BOTH:
    this.currentImage.push();
      this.currentImage.scale(-1, -1);
      this.currentImage.image(
        _image, -this.currentImage.width, -this.currentImage.height
      );
    this.currentImage.pop();
    this.backgroundImage.copy(
      this.currentImage,
      0, 0, _image.width, _image.height, 0, 0, _image.width, _image.height
    );
    break;
    default:
      console.log(
        '[Vida, setBackgroundImage] unhandled mirror value: ' + this.mirror
      );
  }
}

/*
  The main function that processes the image. The function requires passing one
  parameter: an object containing an image to process (typically captured from
  video camera or from video file, but you can use any graphic data converted
  to the p5.Image format). The function updates the background image (in
  progressive background mode), also generates a differential image (between
  the background and the current image) and the threshold image (by testing if
  the brightness of individual pixels of the differential image is above the
  set threshold). The function returns "true" if the image processing process
  has succeeded and "false" if for some reason the processing failed.
*/
p5.prototype.Vida.prototype.updateImageProcessor = function(_image) {
  // check for typically corrupted data
  if(_image === null) {
    console.log('[Vida, updateImageProcessor] error: _image === null');
    return false;
  }
  if(_image.width < 1 || _image.height < 1) {
    console.log(
      '[Vida, updateImageProcessor] possible error: resolution of the _image '
      + 'seems to be incorrect: _image.width = ' + _image.width +
      ' _image.height = ' + _image.height + '.'
    );
    return false;
  }
  /*
    If resolution of the _image is different to the current background image
    VIDA will resize all internal images and the __blobMapArray to meet changed
    requirements.
  */
  if(
    _image.width != this.backgroundImage.width ||
    _image.height != this.backgroundImage.height
  ) {
    console.log(
      '[Vida, updateImageProcessor] adjusting images size to: ' +
      _image.width + ' ' + _image.height
    );
    this.resizeGraphicsWorkaround(
      this.currentImage, _image.width, _image.height
    );
    this.backgroundImage.resize(_image.width, _image.height);
    this.differenceImage.resize(_image.width, _image.height);
    this.thresholdImage.resize(_image.width, _image.height);
    this.resizeBlobMapArray(_image.width, _image.height);
  }
  // load pixels data if needed
  if(this.__automaticPixelsDataTransferFlag) {
    _image.loadPixels();
    this.backgroundImage.loadPixels();
    this.differenceImage.loadPixels();
  }
  /*
    Handle mirroring thanks to the use of built-in p5js graphics capabilities.
    The image passed to the function as a parameter is copied to the internal
    VIDA buffer (this buffer - stored in this.currentImage - is the
    p5.Graphics object) using the possibilities offered by vertical and
    horizontal scaling to flip the image in the selected axis (or axes).
  */
  switch(this.mirror) {
    case this.MIRROR_NONE:
      this.currentImage.image(_image, 0, 0);
    break;
    case this.MIRROR_HORIZONTAL:
      this.currentImage.push();
        this.currentImage.scale(-1, 1);
        this.currentImage.image(_image, -this.currentImage.width, 0);
      this.currentImage.pop();
    break;
    case this.MIRROR_VERTICAL:
      this.currentImage.push();
        this.currentImage.scale(1, -1);
        this.currentImage.image(_image, 0, -this.currentImage.height);
      this.currentImage.pop();
    break;
    case this.MIRROR_BOTH:
    this.currentImage.push();
      this.currentImage.scale(-1, -1);
      this.currentImage.image(
        _image, -this.currentImage.width, -this.currentImage.height
      );
    this.currentImage.pop();
    break;
    default:
      console.log(
        '[Vida, updateImageProcessor] unhandled mirror value: ' +
        this.mirror
      );
  }
  // calc and store "flipped" feedback value
  temp_imageFilterFeedback_flipped = 1.0 - this.imageFilterFeedback;
  // load pixels data if needed
  if(this.__automaticPixelsDataTransferFlag) this.currentImage.loadPixels();
  if(this.progressiveBackgroundFlag) {
    // calc progressive background and difference image
    for(var i = 0; i < this.backgroundImage.pixels.length; i += 4) {
      // calculating background image
      this.backgroundImage.pixels[i] =
        this.backgroundImage.pixels[i] * this.imageFilterFeedback +
        this.currentImage.pixels[i] * temp_imageFilterFeedback_flipped;
      this.backgroundImage.pixels[i + 1] =
        this.backgroundImage.pixels[i + 1] * this.imageFilterFeedback +
        this.currentImage.pixels[i + 1] * temp_imageFilterFeedback_flipped;
      this.backgroundImage.pixels[i + 2] =
        this.backgroundImage.pixels[i + 2] * this.imageFilterFeedback +
        this.currentImage.pixels[i + 2] * temp_imageFilterFeedback_flipped;
      this.backgroundImage.pixels[i + 3] = 255;
      // calculating difference image
      this.differenceImage.pixels[i] =
        Math.abs(
          this.backgroundImage.pixels[i] - this.currentImage.pixels[i]
        );
      this.differenceImage.pixels[i + 1] =
      Math.abs(
          this.backgroundImage.pixels[i + 1] - this.currentImage.pixels[i + 1]
        );
      this.differenceImage.pixels[i + 2] =
      Math.abs(
          this.backgroundImage.pixels[i + 2] - this.currentImage.pixels[i + 2]
        );
      this.differenceImage.pixels[i + 3] = 255;
    }
  }
  else {
    // calc difference image (static background mode)
    for(var i = 0; i < this.backgroundImage.pixels.length; i += 4) {
      this.differenceImage.pixels[i] =
      Math.abs(
          this.backgroundImage.pixels[i] - this.currentImage.pixels[i]
        );
      this.differenceImage.pixels[i + 1] =
      Math.abs(
          this.backgroundImage.pixels[i + 1] - this.currentImage.pixels[i + 1]
        );
      this.differenceImage.pixels[i + 2] =
      Math.abs(
          this.backgroundImage.pixels[i + 2] - this.currentImage.pixels[i + 2]
        );
      this.differenceImage.pixels[i + 3] = 255;
    }
  }
  // load pixels data if needed
  if(this.__automaticPixelsDataTransferFlag) {
    this.backgroundImage.updatePixels();
  }
  /*
  Some operations done inside the loop above they could be made using blending
  techniques built into p5js. It would probably have a positive effect on
  performance. Unfortunately, in version 0.7.2 p5js I noticed errors in the
  built-in blending procedures, so for now I decided to stay with the "manual"
  solution. In the future, the VIDA image processor should be replaced with a
  hardware-based webgl code (shaders).

  this.differenceImage.copy(
    this.backgroundImage,
    0, 0, _image.width, _image.height, 0, 0, _image.width, _image.height
  );
  arrayCopy(_image.pixels, this.differenceImage.pixels);
  this.differenceImage.blend(
    this.backgroundImage,
    0, 0, _image.width, _image.height, 0, 0, _image.width, _image.height,
    this.__sketch.DIFFERENCE
  );
  */
  // update pixel data if needed
  if(this.__automaticPixelsDataTransferFlag) this.differenceImage.updatePixels();
  // copy this.differenceImage to this.thresholdImage
  this.thresholdImage.copy(
    this.differenceImage,
    0, 0, this.currentImage.width, this.currentImage.height,
    0, 0, this.differenceImage.width, this.differenceImage.height
  );
  // process the image to create final b/w threshold image
  this.thresholdImage.filter(this.__sketch.THRESHOLD, this.imageFilterThreshold);
  // load pixel data if needed
  if(this.__automaticPixelsDataTransferFlag) this.thresholdImage.loadPixels();
  return true; // return "true" on the end
}

/*
  Helper function searching for the index of the blob with specified location
  (location means one of two data buffers [arrays within this.__blobs array]
  containing previous or current blobs) and identifier. Usually to indicate the
  location we are interested in, it will be best to use getCurrentBlobsLocation
  and getPreviousBlobsLocation functions - safer solution than accessing
  "private" variables directly. The function returns integer - index of wanted
  blob or -1 if blob with specified identifier can't be found in specified
  location.
*/
p5.prototype.Vida.prototype.findBlobIndexById = function(_location, _id) {
  for(var i = 0; i < this.__blobs[_location].length; i++)
    if(this.__blobs[_location][i].id === _id) return i;
  return -1;
}

/*
  Helper function searching for lowest unsigned integer number which is not yet
  the identifier of any of the blobs stored in specified localization (location
  means one of two data buffers [arrays within this.__blobs array] containing
  previous or current blobs). Usually to indicate the location we are
  interested in, it will be best to use getCurrentBlobsLocation and
  getPreviousBlobsLocation functions - safer solution than accessing "private"
  variables directly. The function can be used to design a better mechanism
  than the VIDA's built-in for assigning identifiers to the detected blobs.
*/
p5.prototype.Vida.prototype.findFirstFreeId = function(_location) {
  var temp_result = 0; var temp_b = true;
  while(temp_b) {
    temp_b = false;
    for(var i = 0; i < this.__blobs[_location].length; i++) {
      if(this.__blobs[_location][i].id === temp_result) {
        temp_b = true; temp_result += 1; break;
      }
    }
  }
  return temp_result;
}

/*
  Main function for sketchy VIDA's built-in indices tracking mechanism which
  tries to recognize the blobs taking into account their location and assign
  them identifiers indicating the continuation of the movement of the detected
  blobs. It's a simple two pass algorithm. In the first run, the algorithm
  detects the most obvious similarities, in the second it tries to match the
  remaining blobs.
*/
p5.prototype.Vida.prototype.trackBlobs = function() {
  /*
    If the buffer containing the previous blobs is empty and there is nothing
    to compare new blobs with, let's give new blobs identifiers based on their
    position in the array
  */
  if(this.__blobs[this.__previousBlobsLocation].length < 1) {
    for(var i = 0; i < this.numberOfDetectedBlobs; i++)
      this.__blobs[this.__currentBlobsLocation][i].id = i;
  }
  else {
    /*
      Theoretically, such a situation should not happen, but if any of the
      previous blobs have a negative index, let's fix it.
    */
    for(var i = 0; i < this.__blobs[this.__previousBlobsLocation].length; i++)
      if(this.__blobs[this.__previousBlobsLocation][i].id < 0)
        this.__blobs[this.__previousBlobsLocation][i].id =
          this.findFirstFreeId(this.__previousBlobsLocation);
  }
  // some reusable variables we need
  var temp_dist, temp_index; var temp_distances = [];
  /*
    At the beginning, let's mark all new blobs as not assigned to any previous
    blob (id = -1). Also let's fill in the cells of the temp_distances array
    with value certainly greater than the values resulting from the normalized
    (in the range from 0.0 to 1.0) coordinates of the blob's mass center that we
    use. It's a trick thanks to which we can significantly simplify the loop
    that searches for the nearest previous blobs.
  */
  for(var i = 0; i < this.numberOfDetectedBlobs; i++) {
    this.__blobs[this.__currentBlobsLocation][i].id = -1;
    temp_distances[i] = 10.0;
  }
  // find nearest previous blobs
  for(var i = 0; i < this.numberOfDetectedBlobs; i++) {
    for(
      var j = 0; j < this.__blobs[this.__previousBlobsLocation].length; j++
    ) {
      // calc the distance between two blobs
      temp_dist = Math.sqrt(
        Math.pow(
          this.__blobs[this.__previousBlobsLocation][j].normMassCenterX - 
            this.__blobs[this.__currentBlobsLocation][i].normMassCenterX,
          2
        ) +
        Math.pow(
          this.__blobs[this.__previousBlobsLocation][j].normMassCenterY - 
            this.__blobs[this.__currentBlobsLocation][i].normMassCenterY,
          2
        )
      );
      /*
        If the distance is smaller than previously memorized and smaller than
        this.trackBlobsMaxNormDist value we memorize it.
      */
      if(
        temp_dist < temp_distances[i] && temp_dist < this.trackBlobsMaxNormDist
      ) {
        temp_distances[i] = temp_dist;
        this.__blobs[this.__currentBlobsLocation][i].id =
          this.__blobs[this.__previousBlobsLocation][j].id;
      }
    }
  }
  /* 
    Remove duplicated indices. It may happen that two or more new blobs are
    closest to one of the previous ones. The following code will eliminate such
    cases and filter out of the groups of new blobs marked with the same
    identifier all but one closest to the previous one (with the same
    identifier).
  */
  for(var i = 0; i < this.numberOfDetectedBlobs; i++) {
    for(var j = 0; j < this.numberOfDetectedBlobs; j++) {
      if(i === j) continue; // that's the same blob!
      // if we found unattached we have nothing to do here
      if(this.__blobs[this.__currentBlobsLocation][i].id < 0) continue;
      if(this.__blobs[this.__currentBlobsLocation][j].id < 0) continue;
      // two blobs with different identifiers: nothing to do
      if(
        this.__blobs[this.__currentBlobsLocation][i].id !==
        this.__blobs[this.__currentBlobsLocation][j].id
      ) continue;
      /*
        If two new blobs are associated with one previous, let's dismiss this
        new blob, which is further from the previous one.
      */
      if(temp_distances[i] > temp_distances[j])
        this.__blobs[this.__currentBlobsLocation][i].id = -1;
      else
        this.__blobs[this.__currentBlobsLocation][j].id = -1;
    }
  }
  // find nearest previous blobs again (but don't touch already fixed indices)
  for(var i = 0; i < this.numberOfDetectedBlobs; i++) {
    // if the new blob is alerady attached to one of previous ones we skip it
    if(this.__blobs[this.__currentBlobsLocation][i].id >= 0) continue;
    // again we are starting with a value higher than normalized distances
    temp_distances[i] = 10.0;
    // find nearest previous blobs
    for(
      var j = 0; j < this.__blobs[this.__previousBlobsLocation].length; j++
    ) {
      /*
        If one of new blobs is already attached to the current previous blob we
        can skip testing it - we already found the best new blob for the
        previous one.
      */
      if(
        this.findBlobIndexById(
          this.__currentBlobsLocation,
          this.__blobs[this.__previousBlobsLocation][j].id
        ) >= 0
      ) continue;
      // calc the distance between two blobs
      temp_dist = Math.sqrt(
        Math.pow(
          this.__blobs[this.__previousBlobsLocation][j].normMassCenterX - 
            this.__blobs[this.__currentBlobsLocation][i].normMassCenterX,
          2
        ) +
        Math.pow(
          this.__blobs[this.__previousBlobsLocation][j].normMassCenterY - 
            this.__blobs[this.__currentBlobsLocation][i].normMassCenterY,
          2
        )
      );
      /*
        If the distance is smaller than previously memorized and smaller than
        this.trackBlobsMaxNormDist value we memorize it.
      */
      if(
        temp_dist < temp_distances[i] && temp_dist < this.trackBlobsMaxNormDist
      ) {
        temp_distances[i] = temp_dist;
        this.__blobs[this.__currentBlobsLocation][i].id =
          this.__blobs[this.__previousBlobsLocation][j].id;
      }
    }
  }
  /*
    Cleanup indices: remove duplicated indices and generate unique indices for
    new blobs not attached to one of the previous blobs. About removing
    duplicated indices: it may happen that two or more new blobs are closest to
    one of the previous ones. The following code will eliminate such cases and
    filter out of the groups of new blobs marked with the same identifier all
    but one closest to the previous one (with the same identifier).
  */
  for(var i = 0; i < this.numberOfDetectedBlobs; i++) {
    for(var j = 0; j < this.numberOfDetectedBlobs; j++) {
      if(i === j) continue; // that's the same blob!
      // we found unattached blob, let's generate a unique identifier
      if(this.__blobs[this.__currentBlobsLocation][i].id < 0) {
        this.__blobs[this.__currentBlobsLocation][i].id =
          this.findFirstFreeId(this.__currentBlobsLocation);
        continue;
      }
      // we found unattached blob, let's generate a unique identifier
      if(this.__blobs[this.__currentBlobsLocation][j].id < 0) {
        this.__blobs[this.__currentBlobsLocation][j].id =
          this.findFirstFreeId(this.__currentBlobsLocation);
        continue;
      }
      // two blobs with different identifiers: nothing to do
      if(
        this.__blobs[this.__currentBlobsLocation][i].id !==
        this.__blobs[this.__currentBlobsLocation][j].id
      ) continue;
      /*
        If two new blobs are associated with one previous, let's dismiss this
        new blob, which is further from the previous one. Let's also generate
        a new, unique identifier for the rejected blob.
      */
      if(temp_distances[i] > temp_distances[j])
        this.__blobs[this.__currentBlobsLocation][i].id =
          this.findFirstFreeId(this.__currentBlobsLocation);
      else
        this.__blobs[this.__currentBlobsLocation][j].id =
          this.findFirstFreeId(this.__currentBlobsLocation);
    }
  }
  /*
    Copy data from the previous blobs to the attached new ones. We need to copy
    the values of variables that store the creation time of the blob and set
    isNewFlag flag as "false" (as the blob is a "continuation" of one of the
    previous blobs).
  */
  for(var i = 0; i < this.numberOfDetectedBlobs; i++) {
    // find previous, "parent" blob
    temp_index = this.findBlobIndexById(
      this.__previousBlobsLocation,
      this.__blobs[this.__currentBlobsLocation][i].id
    );
    if(temp_index < 0) continue; // no previous, "parent" blob, nothing to do
    // copy timestamp and set isNewFlag to "false";
    this.__blobs[this.__currentBlobsLocation][i].creationTime =
      this.__blobs[this.__previousBlobsLocation][temp_index]. creationTime;
    this.__blobs[this.__currentBlobsLocation][i].creationFrameCount =
      this.__blobs[this.__previousBlobsLocation][temp_index].
        creationFrameCount;
    this.__blobs[this.__currentBlobsLocation][i].isNewFlag = false;
  }
}

/*
  A function that calculates, for each blob, a polygon that imitates the shape
  of a blob. The function first calculates the radius of the circle (whose
  center is blob's mass center) which contains the blob. Then it marks the
  points lying on the edge of the circle and located at equal distances to each
  other (the number of points is equal to the value of
  this.pointsPerApproximatedBlobPolygon). For each of the sections marked
  between one the points and the center of the circle the function detects the
  next point: lying on the section, as far as possible from the center of the
  circle, and in the same time lying within the blob. The set of points
  determined in this way consists of a polygon describing roughly the shape of
  a blob. The number of polygon points has an effect on the performance of the
  function, so it is worth keeping as low as possible the values of the
  this.pointsPerApproximatedBlobPolygon variable.
*/
p5.prototype.Vida.prototype.approximateBlobPolygons = function() {
  var temp_2PI = Math.PI * 2; // useful precalculated value
  // some reusable variables we need
  var temp_radius_1, temp_radius_2,
      temp_angle, temp_sin_angle, temp_cos_angle,
      temp_center_x, temp_center_y, temp_x, temp_y;
  /*
    Let's check if the number of polygon points is not too low (for obvious
    reasons, 3 points is the minimum). Let's also check if the value is an
    integer. Correct any errors and let's find out about it by writing an
    relevant message in the console.
  */
  if(this.pointsPerApproximatedBlobPolygon < 3) {
    console.log(
      '[Vida, approximateBlobPolygons] ' +
      'Minumum valid value of pointsPerApproximatedBlobPolygon is 3 ' +
      '(currently: ' +
      this.pointsPerApproximatedBlobPolygon + '). The value will be set to 3'
    );
    this.pointsPerApproximatedBlobPolygon = 3;
  }
  else {
    if(
      Math.floor(this.pointsPerApproximatedBlobPolygon) !==
      Math.ceil(this.pointsPerApproximatedBlobPolygon)
    ) {
      console.log(
        '[Vida, approximateBlobPolygons] ' +
        'The variable pointsPerApproximatedBlobPolygon should be of the ' +
        'integer type, not a float. Current value ' +
        this.pointsPerApproximatedBlobPolygon + ' will be changed to' +
        Math.floor(this.pointsPerApproximatedBlobPolygon) + '.'
      );
      this.pointsPerApproximatedBlobPolygon =
        Math.floor(this.pointsPerApproximatedBlobPolygon)
    }
  }
  // iterate over detected blobs
  for(var i = 0; i < this.numberOfDetectedBlobs; i++) {
    /*
      Check which from the corner points of the blob's bounding box lies
      farthest from the center of the mass of the blob. The distance between
      this point and the mass center of the blob will be treated as the base
      radius of the circle describing the blob.
    */
    // left upper corner
    temp_radius_1 = Math.sqrt(
      Math.pow(
        (
          this.__blobs[this.__currentBlobsLocation][i].normRectX -
          this.__blobs[this.__currentBlobsLocation][i].normMassCenterX
        ) * this.thresholdImage.width, 2
      ) +
      Math.pow(
        (
          this.__blobs[this.__currentBlobsLocation][i].normRectY -
          this.__blobs[this.__currentBlobsLocation][i].normMassCenterY
        ) * this.thresholdImage.height, 2
      )
    );
    // right upper corner
    temp_radius_2 = Math.sqrt(
      Math.pow(
        (
          this.__blobs[this.__currentBlobsLocation][i].normRectX +
          this.__blobs[this.__currentBlobsLocation][i].normRectW -
          this.__blobs[this.__currentBlobsLocation][i].normMassCenterX
        ) * this.thresholdImage.width, 2
      ) +
      Math.pow(
        (
          this.__blobs[this.__currentBlobsLocation][i].normRectY -
          this.__blobs[this.__currentBlobsLocation][i].normMassCenterY
        ) * this.thresholdImage.height, 2
      )
    );
    if(temp_radius_1 < temp_radius_2) temp_radius_1 = temp_radius_2;
    // right bottom corner
    temp_radius_2 = Math.sqrt(
      Math.pow(
        (
          this.__blobs[this.__currentBlobsLocation][i].normRectX +
          this.__blobs[this.__currentBlobsLocation][i].normRectW -
          this.__blobs[this.__currentBlobsLocation][i].normMassCenterX
        ) * this.thresholdImage.width, 2
      ) +
      Math.pow(
        (
          this.__blobs[this.__currentBlobsLocation][i].normRectY +
          this.__blobs[this.__currentBlobsLocation][i].normRectH -
          this.__blobs[this.__currentBlobsLocation][i].normMassCenterY
        ) * this.thresholdImage.height, 2
      )
    );
    if(temp_radius_1 < temp_radius_2) temp_radius_1 = temp_radius_2;
    // left bottom corner
    temp_radius_2 = Math.sqrt(
      Math.pow(
        (
          this.__blobs[this.__currentBlobsLocation][i].normRectX -
          this.__blobs[this.__currentBlobsLocation][i].normMassCenterX
        ) * this.thresholdImage.width, 2
      ) +
      Math.pow(
        (
          this.__blobs[this.__currentBlobsLocation][i].normRectY +
          this.__blobs[this.__currentBlobsLocation][i].normRectH -
          this.__blobs[this.__currentBlobsLocation][i].normMassCenterY
        ) * this.thresholdImage.height, 2
      )
    );
    if(temp_radius_1 < temp_radius_2) temp_radius_1 = temp_radius_2;
    temp_radius_1 = Math.floor(temp_radius_1); // "convert" radius to integer
    // calc pixel-based coordintates of the center of the mass of the blob
    temp_center_x =
      Math.floor(
        this.__blobs[this.__currentBlobsLocation][i].normMassCenterX *
        this.thresholdImage.width
      );
    temp_center_y =
      Math.floor(
        this.__blobs[this.__currentBlobsLocation][i].normMassCenterY *
        this.thresholdImage.height
      );
    /*
      Now we have to calculate coordinates of every point of the polygon.
    */
    for(var j = 0; j < this.pointsPerApproximatedBlobPolygon; j++) {
      /*
        First, let's determine the angle that will be used to determine the
        section of the circle that interests us.
      */
      temp_angle = j / this.pointsPerApproximatedBlobPolygon * temp_2PI;
      // calc sin and cos of the angle
      temp_sin_angle = Math.sin(temp_angle);
      temp_cos_angle = Math.cos(temp_angle);
      /*
        Now, by changing the radius of the circle, but using the same angle, we
        will calculate the coordinates of the subsequent points each of which
        is closer to the center of the circle (the radius gradually decreases
        with each repetition of the loop).
      */
      for(var r = temp_radius_1; r >= 0; r--) {
        temp_x = Math.floor(temp_center_x + r * temp_cos_angle);
        temp_y = Math.floor(temp_center_y + r * temp_sin_angle);
        /*
          We need to make sure that the coordinates of the point are inside the
          image being processed.
        */
        if(temp_x < 0) {
          temp_x = 0;
        }
        else {
          if(temp_x >= this.thresholdImage.width)
            temp_x = this.thresholdImage.width - 1;
        }
        if(temp_y < 0) {
          temp_y = 0;
        }
        else {
          if(temp_y >= this.thresholdImage.height)
            temp_y = this.thresholdImage.height - 1;
        }
        /*
          If the coordinates of the point refer to a point that is part of the
          blobe, we break the loop.
        */
        if(
          this.__blobMapArray[temp_x][temp_y] ===
          this.__blobs[this.__currentBlobsLocation][i].__rawId
        ) break;
      }
      /*
        We convert the coordinates to normalized values and memorize them.
      */
      this.__blobs[this.__currentBlobsLocation][i].approximatedPolygon[j] =
        {
          normX: temp_x / this.thresholdImage.width,
          normY: temp_y / this.thresholdImage.height
        };
    }
  }
}

/*
  Function that rejects blobs if their bounding boxes are located inside of the
  bounding boxes of the larger blobs.
*/
p5.prototype.Vida.prototype.rejectInnerBlobs = function() {
  for(var i = this.numberOfDetectedBlobs - 1; i >= 0; i--) {
    for(var j = this.numberOfDetectedBlobs - 1; j >= 0; j--) {
      if(i == j) continue; // the same blob, skip this case
      // check if first blob is located inside the second one
      if(
        this.__blobs[this.__currentBlobsLocation][j].normRectX <
        this.__blobs[this.__currentBlobsLocation][i].normRectX
      ) continue;
      if(
        this.__blobs[this.__currentBlobsLocation][j].normRectY <
        this.__blobs[this.__currentBlobsLocation][i].normRectY
      ) continue;
      if(
        this.__blobs[this.__currentBlobsLocation][j].normRectX +
        this.__blobs[this.__currentBlobsLocation][j].normRectW <
        this.__blobs[this.__currentBlobsLocation][i].normRectX +
        this.__blobs[this.__currentBlobsLocation][i].normRectW
      ) continue;
      if(
        this.__blobs[this.__currentBlobsLocation][j].normRectY +
        this.__blobs[this.__currentBlobsLocation][j].normRectH <
        this.__blobs[this.__currentBlobsLocation][i].normRectY +
        this.__blobs[this.__currentBlobsLocation][i].normRectH
      ) continue;
      // delete the "inner" blob
      this.__blobs[this.__currentBlobsLocation].splice(j, 1);
      // update number of blobs
      this.numberOfDetectedBlobs -= 1;
    }
  }
}

/*
  Function that rejects blobs if their bounding boxes contain entirely
  (smaller) bounding boxes of other blobs.
*/
p5.prototype.Vida.prototype.rejectOuterBlobs = function() {
  for(var i = this.numberOfDetectedBlobs - 1; i >= 0; i--) {
    for(var j = this.numberOfDetectedBlobs - 1; j >= 0; j--) {
      if(i == j) continue; // the same blob, skip this case
      // check if second blob is located inside the first one
      if(
        this.__blobs[this.__currentBlobsLocation][j].normRectX >
        this.__blobs[this.__currentBlobsLocation][i].normRectX
      ) continue;
      if(
        this.__blobs[this.__currentBlobsLocation][j].normRectY >
        this.__blobs[this.__currentBlobsLocation][i].normRectY
      ) continue;
      if(
        this.__blobs[this.__currentBlobsLocation][j].normRectX +
        this.__blobs[this.__currentBlobsLocation][j].normRectW >
        this.__blobs[this.__currentBlobsLocation][i].normRectX +
        this.__blobs[this.__currentBlobsLocation][i].normRectW
      ) continue;
      if(
        this.__blobs[this.__currentBlobsLocation][j].normRectY +
        this.__blobs[this.__currentBlobsLocation][j].normRectH >
        this.__blobs[this.__currentBlobsLocation][i].normRectY +
        this.__blobs[this.__currentBlobsLocation][i].normRectH
      ) continue;
      // delete the "outer" blob
      this.__blobs[this.__currentBlobsLocation].splice(j, 1);
      // update number of blobs
      this.numberOfDetectedBlobs -= 1;
    }
  }
}

/*
  Function that performs a series of preliminary calculations for hulling the
  detected blobs. The function calculates normalized coordinates centers of
  mass of the blobs and their bounding boxes. It also filters out too small or
  too large blobs: the range in which the normalized mass of the blob must be
  located is limited by the values of variables this.normMinBlobMass and
  this.normMaxBlobMass and the range in which the normalized area (of the
  bounding box) of the blob must be located is limited by the values of
  variables this.normMinBlobArea and this.normMaxBlobArea.
*/
p5.prototype.Vida.prototype.processBlobs = function() {
  var temp_raw_blobs_data = []; // temporary storage for blobs
  var temp_index = -1; // helper variable for storing identifiers of the blobs
  var temp_number_of_blobs = 0; // helper variable to count the blobs
  var temp_area; // helper variable storing area of the tested blob
  /*
    We first fill in the temp_raw_blobs_data array holding the working versions
    of the blobs data. We assign intentional variables that store normalized
    parameters of the value outside the normalized range - this will help
    simplify the code and determine the true values of these parameters.
  */
  for(var i = 0; i < this.numberOfDetectedBlobs; i++)
    temp_raw_blobs_data[i] = {
      __rawId: (i + 1),
      mass: 0, normMass: 0.0, normMassX: 0.0, normMassY: 0.0,
      normMinX: 100000.0, normMinY: 100000.0, normMaxX: -10.0, normMaxY: -10.0
    };
  // iterate over all pixels to find blob's data
  for(var y = 0; y < this.thresholdImage.height; y++) {
    for(var x = 0; x < this.thresholdImage.width; x++) {
      /*
        Blobs identifiers in this.__blobMapArray array are starting from 0. We
        need 0-based model, because we are using identifiers as cell addresses
        in the temp_raw_blobs_data array.
      */
      temp_index = this.__blobMapArray[x][y] - 1;
      if(temp_index < 0) continue; // no blob here, skip this case
      /*
        If the pixel being tested is part of a blob, we update the
        corresponding data stored in the temp_raw_blobs_data array.
      */
      // update mass parameters
      temp_raw_blobs_data[temp_index].normMassX += x;
      temp_raw_blobs_data[temp_index].normMassY += y;
      temp_raw_blobs_data[temp_index].mass += 1;
      // update bounding box parameters
      if(x < temp_raw_blobs_data[temp_index].normMinX) {
        temp_raw_blobs_data[temp_index].normMinX = x;
      }
      else {
        if(x > temp_raw_blobs_data[temp_index].normMaxX)
          temp_raw_blobs_data[temp_index].normMaxX = x;
      }
      if(y < temp_raw_blobs_data[temp_index].normMinY) {
        temp_raw_blobs_data[temp_index].normMinY = y;
      }
      else {
        if(y > temp_raw_blobs_data[temp_index].normMaxY)
          temp_raw_blobs_data[temp_index].normMaxY = y;
      }
    }
  }
  /*
    Empty blob's storage and reset this.numberOfDetectedBlobs before we start
    put new blobs into the array.
  */
  this.__blobs[this.__currentBlobsLocation].splice(
    0, this.__blobs[this.__currentBlobsLocation].length
  );
  // iterate over detected blobs
  for(var i = 0; i < this.numberOfDetectedBlobs; i++) {
    // calculate normalized value of the blob mass before we use it
    temp_raw_blobs_data[i].normMass =
      temp_raw_blobs_data[i].mass /
      (this.thresholdImage.height * this.thresholdImage.width);
    // calculate normalized value of the blob area before we use it
    temp_area =
      (temp_raw_blobs_data[i].normMaxX - temp_raw_blobs_data[i].normMinX) *
      (temp_raw_blobs_data[i].normMaxY - temp_raw_blobs_data[i].normMinY) /
      (this.backgroundImage.width * this.backgroundImage.height);
    /*
      Before adding a blob to the result list, we check, if it's mass and area
      satisfies our expectations.
    */
    if(
      temp_raw_blobs_data[i].normMass < this.normMinBlobMass ||
      temp_raw_blobs_data[i].normMass > this.normMaxBlobMass ||
      temp_area                       < this.normMinBlobArea ||
      temp_area                       > this.normMaxBlobArea
    ) continue; // blob is to small or to heavy, skip it
    /*
      The blob mass qualifies it for further processing. Let's convert the
      remaining required parameters to a normalized format.
    */
    temp_raw_blobs_data[i].normMassX /= temp_raw_blobs_data[i].mass;
    temp_raw_blobs_data[i].normMassY /= temp_raw_blobs_data[i].mass;
    temp_raw_blobs_data[i].normMassX /= this.backgroundImage.width;
    temp_raw_blobs_data[i].normMassY /= this.backgroundImage.height;
    temp_raw_blobs_data[i].normMinX /= this.thresholdImage.width;
    temp_raw_blobs_data[i].normMinY /= this.thresholdImage.height;
    temp_raw_blobs_data[i].normMaxX /= this.thresholdImage.width;
    temp_raw_blobs_data[i].normMaxY /= this.thresholdImage.height;
    // create new VidaBlob object and put it into the array
    this.__blobs[this.__currentBlobsLocation][temp_number_of_blobs] =
      new this.__sketch.VidaBlob(this.__sketch);
    /*
      Fill the object with parameters from the temporary storage
      (temp_raw_blobs_data).
    */
    this.__blobs[this.__currentBlobsLocation][temp_number_of_blobs].
      normMassCenterX = temp_raw_blobs_data[i].normMassX;
    this.__blobs[this.__currentBlobsLocation][temp_number_of_blobs].
      normMassCenterY = temp_raw_blobs_data[i].normMassY;
    this.__blobs[this.__currentBlobsLocation][temp_number_of_blobs].normRectX =
      temp_raw_blobs_data[i].normMinX;
    this.__blobs[this.__currentBlobsLocation][temp_number_of_blobs].normRectY =
      temp_raw_blobs_data[i].normMinY;
    this.__blobs[this.__currentBlobsLocation][temp_number_of_blobs].normRectW =
      temp_raw_blobs_data[i].normMaxX - temp_raw_blobs_data[i].normMinX;
    this.__blobs[this.__currentBlobsLocation][temp_number_of_blobs].normRectH =
      temp_raw_blobs_data[i].normMaxY - temp_raw_blobs_data[i].normMinY;
    this.__blobs[this.__currentBlobsLocation][temp_number_of_blobs].normMass =
      temp_raw_blobs_data[i].normMass;
    this.__blobs[this.__currentBlobsLocation][temp_number_of_blobs].__rawId =
      temp_raw_blobs_data[i].__rawId;
    // set timetag
    this.__blobs[this.__currentBlobsLocation][temp_number_of_blobs].
      creationTime = this.__sketch.millis();
    this.__blobs[this.__currentBlobsLocation][temp_number_of_blobs].
      creationFrameCount = this.__sketch.frameCount;
    temp_number_of_blobs += 1; // update temporary number of blobs
  }
  this.numberOfDetectedBlobs = temp_number_of_blobs;
}

/*
  Function updating information on detected moving objects (blobs) in the
  monitored image.
*/
p5.prototype.Vida.prototype.updateBlobs = function() {
  // swap addresses to the current and previous blob's storages
  this.__currentBlobsLocation = (this.__currentBlobsLocation + 1) % 2;
  this.__previousBlobsLocation = (this.__currentBlobsLocation + 1) % 2;
  // call this.findBlobs()... to find blobs
  this.numberOfDetectedBlobs = this.findBlobs();
  /*
    this.processBlobs() performs pre-filtration of the detected blobs: sieves
    too small or too large, also calculates the mass of blobs and rectangles
    describing them (bounding boxes).
  */
  this.processBlobs();
  // apply selected filtering mechanism to remove unnecessary blobs
  switch(this.rejectBlobsMethod) {
    case this.REJECT_NONE_BLOBS: /* nothing to do */ break;
    case this.REJECT_INNER_BLOBS: this.rejectInnerBlobs(); break;
    case this.REJECT_OUTER_BLOBS: this.rejectOuterBlobs(); break;
    default:
      console.log(
        '[Vida, updateBlobs] unhandled rejectBlobsMethod value: ' +
        this.rejectBlobsMethod
      );
  }
  /*
    If this.trackBlobsFlag flag is set (it's value is "true") a mechanism for
    comparing buffers containing new and previous ones will be applied. This
    mechanism attempts to match new blobs with previous ones and, if possible,
    give new blobs identifiers that indicate that they are the next phases of
    movement of the same objects. If this.trackBlobsFlag flag is not set (it's
    value is "false") the new blobs will receive arbitrarily assigned
    identifiers resulting from their location in this.__blobs array.
  */
  if(this.trackBlobsFlag) {
    // call tracking function
    this.trackBlobs();
  }
  else {
    // iterate over blobs to give them arbitrary identifiers
    for(var i = 0; i < this.numberOfDetectedBlobs; i++)
      this.__blobs[this.__currentBlobsLocation][i].id = i;
  }
  /*
    If this.approximateBlobPolygonsFlag flag is set (it's value is "true") a
    polygon that mimics it's shape will be constructed for each blob. If
    this.approximateBlobPolygonsFlag flag is not set (it's value is "false")
    the arrays holding the polygon's points will be empty.
  */
  if(this.approximateBlobPolygonsFlag) this.approximateBlobPolygons();
}

/*
  The function managing blobs detection. The procedure is expensive
  computationally so it is worth sticking to the lowest possible resolution of
  the image being processed. Maybe in the future versions of the library some
  calculations could be transferred to the GPU (shaders). The function returns
  number of detected blobs.
*/
p5.prototype.Vida.prototype.findBlobs = function() {
  /*
    The first pass fills cells of the this.__blobMapArray arrays with
    identifiers of detected blobs (cells not connected to any blob will be
    filled with 0), but it can happen that elements of the same blob have
    different identifiers.
  */
  this.findBlobs_createTemporaryIndices();
  /*
    The following variables will be used to control whether procedures unifying
    the identifiers entered into the cells of the array storing blobs should
    (or will not) be restarted.
  */
  var temp_previousNumberOfIdentifiers = -1;
  var temp_currentNumberOfIdentifiers = 0;
  /*
    This loop will be run as long as the code contained in it will decrease the
    number of blob's identifiers in the this.__blobMapArray array.
  */
  while(temp_previousNumberOfIdentifiers !== temp_currentNumberOfIdentifiers) {
    /*
      We have two very similar procedures that unify identifiers within each
      detected blob. Because the first of the procedures searches the array by
      rows starting from the left upper corner, and the second searches the
      array by columns starting from the right bottom corner using both
      procedures sequentially provides relatively good code performance.
    */
    this.findBlobs_mergerIterationA(); this.findBlobs_mergerIterationB();
    /*
      Now we are updating the variables that stores the number of identifiers
      used before and after the application of unification procedures.
    */
    temp_previousNumberOfIdentifiers = temp_currentNumberOfIdentifiers;
    temp_currentNumberOfIdentifiers =
      this.findBlobs_countUnorderedIdentifiers();
  }
  /*
    After unifying the identifiers within individual blobs, we organize them so
    that the list of identifiers starts with the number 1, grows with step 1
    and without any "holes". Finally return number of detected blobs.
  */
  return this.findBlobs_optimizeIdentifiers();
}

/*
  The element of the mechanism for detecting blobs. The function fills the array
  this.__blobMapArray with temporary identifiers (if tested pixel in the
  this.thresholdImage buffer is not black corresponding cell in the
  this.__blobMapArray will be filled with integer value > 0). Important: after
  applying this procedure, pixels that make up the same blob can be marked with
  different identifiers, so you need to unify the identifiers later.
*/
p5.prototype.Vida.prototype.findBlobs_createTemporaryIndices = function() {
  var temp_pixel_position; // index of the pixel we want to test
  var temp_blob_identifier = 1; // as the name suggests
  /*
    To prevent testing for each cell, whether it lies on the edge of the array
    (which would require additional conditional instructions and slow down the
    code significantly) the function will only operate on the "internal" cells
    of the array (we leave margins composed of one column on the left and right
    side and one row of cells from the top and bottom). This is also important
    because of complicated interactions with other functions from the
    findBlobs_XXXXXXXXXXX family - in order for these functions to work
    properly, we must maintain a "clean" (filled with 0) "frame" at the
    boundaries of the this.__blobMapArray array.
  */
  var temp_wmax = this.thresholdImage.width - 1; // safe bounds
  var temp_hmax = this.thresholdImage.height - 1; // safe bounds
  this.resetBlobMapArray(); // clear the array
  for(var temp_y = 1; temp_y < temp_hmax; temp_y++) {
    for(var temp_x = 1; temp_x < temp_wmax; temp_x++) {
      /* 
        Convert pixel coordinates to the address inside
        this.thresholdImage.pixels array.
      */
      temp_pixel_position =
        (temp_y * this.thresholdImage.width + temp_x) * 4;
      // we're only looking at the red component (this.thresholdImage is b/w)
      if(this.thresholdImage.pixels[temp_pixel_position] > 0)
        this.__blobMapArray[temp_x][temp_y] = temp_blob_identifier;
      else
        temp_blob_identifier += 1; // increment value when pixel is empty
    }
  }
}

/*
  The first of two functions to unify the identifiers within individual blobs.
  Both functions comb through an array containing blob identifiers and for each
  cell they search for the lowest identifier (by comparing the cell identifier
  with the identifiers of the nearest neighbors). This lowest identifier will
  be assigned to the cell being tested and it's neighbors. Both functions
  differ in the search direction: the first searches the array with rows
  starting from the upper left corner, the second searches the array with
  columns starting from the bottom right corner.
*/
p5.prototype.Vida.prototype.findBlobs_mergerIterationA = function() {
  /*
    These variables will be used to store the state of cells adjacent to the
    tested one. They are listed according to geographical nomenclature, from
    the north, clockwise.
  */
  var temp_nn, temp_ne, temp_ee, temp_se, temp_ss, temp_sw, temp_ww, temp_nw;
  /*
    To prevent testing for each cell, whether it lies on the edge of the array
    (which would require additional conditional instructions and slow down the
    code significantly) the function will only operate on the "internal" cells
    of the array (we leave margins composed of one column on the left and right
    side and one row of cells from the top and bottom). This is also important
    because of complicated interactions with other functions from the
    findBlobs_XXXXXXXXXXX family - in order for these functions to work
    properly, we must maintain a "clean" (filled with 0) "frame" at the
    boundaries of the this.__blobMapArray array.
  */
  var temp_wmax = this.thresholdImage.width - 1; // safe bounds
  var temp_hmax = this.thresholdImage.height - 1; // safe bounds
  /*
    Variable that stores the lowest detected identifier occurring around the
    cell being tested.
  */
  var temp_lowest_index;
  /*
    We scan the array by moving in rows and starting from the upper left
    corner.
  */
  for(var temp_y = 1; temp_y < temp_hmax; temp_y++) {
    for(var temp_x = 1; temp_x < temp_wmax; temp_x++) {
      // empty cell (no blob), move to the next one
      if(this.__blobMapArray[temp_x][temp_y] === 0) continue;
      // collect statuses of neighboring cells
      temp_nn = this.__blobMapArray[temp_x    ][temp_y - 1];
      temp_ne = this.__blobMapArray[temp_x + 1][temp_y - 1];
      temp_ee = this.__blobMapArray[temp_x + 1][temp_y    ];
      temp_se = this.__blobMapArray[temp_x + 1][temp_y + 1];
      temp_ss = this.__blobMapArray[temp_x    ][temp_y + 1];
      temp_sw = this.__blobMapArray[temp_x - 1][temp_y + 1];
      temp_ww = this.__blobMapArray[temp_x - 1][temp_y    ];
      temp_nw = this.__blobMapArray[temp_x - 1][temp_y - 1];
      // search for the lowest available identifier
      temp_lowest_index = this.__blobMapArray[temp_x][temp_y];
      if(temp_nn > 0 && temp_nn < temp_lowest_index)
        temp_lowest_index = temp_nn;
      if(temp_ne > 0 && temp_ne < temp_lowest_index)
        temp_lowest_index = temp_ne;
      if(temp_ee > 0 && temp_ee < temp_lowest_index)
        temp_lowest_index = temp_ee;
      if(temp_se > 0 && temp_se < temp_lowest_index)
        temp_lowest_index = temp_se;
      if(temp_ss > 0 && temp_ss < temp_lowest_index)
        temp_lowest_index = temp_ss;
      if(temp_sw > 0 && temp_sw < temp_lowest_index)
        temp_lowest_index = temp_sw;
      if(temp_ww > 0 && temp_ww < temp_lowest_index)
        temp_lowest_index = temp_ww;
      if(temp_nw > 0 && temp_nw < temp_lowest_index)
        temp_lowest_index = temp_nw;
      /*
        Fill in the tested cell and neighboring with value of the
        identifier.
      */
      this.__blobMapArray[temp_x][temp_y] = temp_lowest_index;
      if(this.__blobMapArray[temp_x    ][temp_y - 1] > 0)
          this.__blobMapArray[temp_x    ][temp_y - 1] = temp_lowest_index;
      if(this.__blobMapArray[temp_x + 1][temp_y - 1] > 0)
          this.__blobMapArray[temp_x + 1][temp_y - 1] = temp_lowest_index;
      if(this.__blobMapArray[temp_x + 1][temp_y    ] > 0)
          this.__blobMapArray[temp_x + 1][temp_y    ] = temp_lowest_index;
      if(this.__blobMapArray[temp_x + 1][temp_y + 1] > 0)
          this.__blobMapArray[temp_x + 1][temp_y + 1] = temp_lowest_index;
      if(this.__blobMapArray[temp_x    ][temp_y + 1] > 0)
          this.__blobMapArray[temp_x    ][temp_y + 1] = temp_lowest_index;
      if(this.__blobMapArray[temp_x - 1][temp_y + 1] > 0)
          this.__blobMapArray[temp_x - 1][temp_y + 1] = temp_lowest_index;
      if(this.__blobMapArray[temp_x - 1][temp_y    ] > 0)
          this.__blobMapArray[temp_x - 1][temp_y    ] = temp_lowest_index;
      if(this.__blobMapArray[temp_x - 1][temp_y - 1] > 0)
          this.__blobMapArray[temp_x - 1][temp_y - 1] = temp_lowest_index;
    }
  }
}

/*
  The second of two functions to unify the identifiers within individual blobs.
  Both functions comb through an array containing blob identifiers and for each
  cell they search for the lowest identifier (by comparing the cell identifier
  with the identifiers of the nearest neighbors). This lowest identifier will
  be assigned to the cell being tested and it's neighbors. Both functions
  differ in the search direction: the first searches the array with rows
  starting from the upper left corner, the second searches the array with
  columns starting from the bottom right corner.
*/
p5.prototype.Vida.prototype.findBlobs_mergerIterationB = function() {
  /*
    These variables will be used to store the state of cells adjacent to the
    tested one. They are listed according to geographical nomenclature, from
    the north, clockwise.
  */
  var temp_nn, temp_ne, temp_ee, temp_se, temp_ss, temp_sw, temp_ww, temp_nw;
  /*
    To prevent testing for each cell, whether it lies on the edge of the array
    (which would require additional conditional instructions and slow down the
    code significantly) the function will only operate on the "internal" cells
    of the array (we leave margins composed of one column on the left and right
    side and one row of cells from the top and bottom). This is also important
    because of complicated interactions with other functions from the
    findBlobs_XXXXXXXXXXX family - in order for these functions to work
    properly, we must maintain a "clean" (filled with 0) "frame" at the
    boundaries of the this.__blobMapArray array.
  */
  var temp_wmax = this.thresholdImage.width - 2; // safe bounds
  var temp_hmax = this.thresholdImage.height - 2; // safe bounds
  /*
    Variable that stores the lowest detected identifier occurring around the
    cell being tested.
  */
  var temp_lowest_index;
  /*
    We scan the array by moving in columns and starting from the bottom right
    corner.
  */
  for(var temp_x = temp_wmax; temp_x > 0; temp_x--) {
    for(var temp_y = temp_hmax; temp_y > 0; temp_y--) {
      // empty cell (no blob), move to the next one
      if(this.__blobMapArray[temp_x][temp_y] === 0) continue;
      // collect statuses of neighboring cells
      temp_nn = this.__blobMapArray[temp_x    ][temp_y - 1];
      temp_ne = this.__blobMapArray[temp_x + 1][temp_y - 1];
      temp_ee = this.__blobMapArray[temp_x + 1][temp_y    ];
      temp_se = this.__blobMapArray[temp_x + 1][temp_y + 1];
      temp_ss = this.__blobMapArray[temp_x    ][temp_y + 1];
      temp_sw = this.__blobMapArray[temp_x - 1][temp_y + 1];
      temp_ww = this.__blobMapArray[temp_x - 1][temp_y    ];
      temp_nw = this.__blobMapArray[temp_x - 1][temp_y - 1];
      // search for the lowest available identifier
      temp_lowest_index = this.__blobMapArray[temp_x][temp_y];
      if(temp_nn > 0 && temp_nn < temp_lowest_index)
        temp_lowest_index = temp_nn;
      if(temp_ne > 0 && temp_ne < temp_lowest_index)
        temp_lowest_index = temp_ne;
      if(temp_ee > 0 && temp_ee < temp_lowest_index)
        temp_lowest_index = temp_ee;
      if(temp_se > 0 && temp_se < temp_lowest_index)
        temp_lowest_index = temp_se;
      if(temp_ss > 0 && temp_ss < temp_lowest_index)
        temp_lowest_index = temp_ss;
      if(temp_sw > 0 && temp_sw < temp_lowest_index)
        temp_lowest_index = temp_sw;
      if(temp_ww > 0 && temp_ww < temp_lowest_index)
        temp_lowest_index = temp_ww;
      if(temp_nw > 0 && temp_nw < temp_lowest_index)
        temp_lowest_index = temp_nw;
      /*
        Fill in the tested cell and neighboring with value of the
        identifier.
      */
      this.__blobMapArray[temp_x][temp_y] = temp_lowest_index;
      if(this.__blobMapArray[temp_x    ][temp_y - 1] > 0)
        this.__blobMapArray[temp_x    ][temp_y - 1] = temp_lowest_index;
      if(this.__blobMapArray[temp_x + 1][temp_y - 1] > 0)
        this.__blobMapArray[temp_x + 1][temp_y - 1] = temp_lowest_index;
      if(this.__blobMapArray[temp_x + 1][temp_y    ] > 0)
        this.__blobMapArray[temp_x + 1][temp_y    ] = temp_lowest_index;
      if(this.__blobMapArray[temp_x + 1][temp_y + 1] > 0)
        this.__blobMapArray[temp_x + 1][temp_y + 1] = temp_lowest_index;
      if(this.__blobMapArray[temp_x    ][temp_y + 1] > 0)
        this.__blobMapArray[temp_x    ][temp_y + 1] = temp_lowest_index;
      if(this.__blobMapArray[temp_x - 1][temp_y + 1] > 0)
        this.__blobMapArray[temp_x - 1][temp_y + 1] = temp_lowest_index;
      if(this.__blobMapArray[temp_x - 1][temp_y    ] > 0)
        this.__blobMapArray[temp_x - 1][temp_y    ] = temp_lowest_index;
      if(this.__blobMapArray[temp_x - 1][temp_y - 1] > 0)
        this.__blobMapArray[temp_x - 1][temp_y - 1] = temp_lowest_index;
    }
  }
}

/*
  This function optimizes the blobs' identifiers to assign blobs to identifiers
  that are integers beginning with 1 and increasing with steop 1 (without
  "holes").
*/
p5.prototype.Vida.prototype.findBlobs_optimizeIdentifiers = function() {
  /*
    To prevent testing for each cell, whether it lies on the edge of the array
    (which would require additional conditional instructions and slow down the
    code significantly) the function will only operate on the "internal" cells
    of the array (we leave margins composed of one column on the left and right
    side and one row of cells from the top and bottom). This is also important
    because of complicated interactions with other functions from the
    findBlobs_XXXXXXXXXXX family - in order for these functions to work
    properly, we must maintain a "clean" (filled with 0) "frame" at the
    boundaries of the this.__blobMapArray array.
  */
  var temp_wmax = this.thresholdImage.width - 1; // safe bounds
  var temp_hmax = this.thresholdImage.height - 1; // safe bounds
  // array storing identifiers we want to change
  var temp_redirections_array = [];
  /*
    Setting this flag (as "true") will mean that the array containing the list
    of identifiers to be changed needs to be supplemented with the current
    identifier.
  */
  var temp_b;
  /*
    We scan the array by moving in rows and starting from the upper left
    corner.
  */
  for(var temp_y = 1; temp_y < temp_hmax; temp_y++) {
    for(var temp_x = 1; temp_x < temp_wmax; temp_x++) {
      // empty cell (no blob), move to the next one
      if(this.__blobMapArray[temp_x][temp_y] === 0) continue;
      temp_b = true; // reset the flag to the default value
      // iterate over the temp_redirections_array
      for(var i = 0; i < temp_redirections_array.length; i++) {
        /* 
          If current identifier is already in the list we can set optimal
          identifier, switch off the flag and escape from the loop.
        */
        if(
          temp_redirections_array[i] === this.__blobMapArray[temp_x][temp_y]
        ) {
          this.__blobMapArray[temp_x][temp_y] = i + 1;
          temp_b = false;
          break;
        }
      }
      /*
        If the temp_b flag is set to "true", we complete the table of
        identifiers that require optimization with the current identifier.
      */
      if(temp_b) {
        temp_redirections_array[temp_redirections_array.length] =
          this.__blobMapArray[temp_x][temp_y];
        this.__blobMapArray[temp_x][temp_y] =
          temp_redirections_array.length;
      }
    }
  }
  /*
    The function returns number of processed identifiers.
  */
  return temp_redirections_array.length;
}

/*
  This function counts the number of identifiers used to describe the blobs.
  This is not always equal to the actual number of detected blobs, because
  unoptimized data may contain blobs consisting of components with different
  identifiers.
*/
p5.prototype.Vida.prototype.findBlobs_countUnorderedIdentifiers = function() {
  /*
    To prevent testing for each cell, whether it lies on the edge of the array
    (which would require additional conditional instructions and slow down the
    code significantly) the function will only operate on the "internal" cells
    of the array (we leave margins composed of one column on the left and right
    side and one row of cells from the top and bottom). This is also important
    because of complicated interactions with other functions from the
    findBlobs_XXXXXXXXXXX family - in order for these functions to work
    properly, we must maintain a "clean" (filled with 0) "frame" at the
    boundaries of the this.__blobMapArray array.
  */
  var temp_wmax = this.thresholdImage.width - 1; // safe bounds
  var temp_hmax = this.thresholdImage.height - 1; // safe bounds
  var temp_identifiers_array = []; // list of detected identifiers
  /*
    Setting this flag (as "true") will mean that the array containing the list
    of identifiers needs to be supplemented with the current identifier.
  */
  var temp_b;
  /*
    We scan the array by moving in rows and starting from the upper left
    corner.
  */
  for(var temp_y = 1; temp_y < temp_hmax; temp_y++) {
    for(var temp_x = 1; temp_x < temp_wmax; temp_x++) {
      // empty cell (no blob), move to the next one
      if(this.__blobMapArray[temp_x][temp_y] === 0) continue;
      temp_b = true; // reset the flag to the default value
      // iterate over the temp_identifiers_array
      for(var i = 0; i < temp_identifiers_array.length; i++) {
        /* 
          If current identifier is already in the list we can set optimal
          identifier, switch off the flag and escape from the loop.
        */
        if(
          temp_identifiers_array[i] === this.__blobMapArray[temp_x][temp_y]
        ) {
          temp_b = false;
          break;
        }
      }
      /*
        If the temp_b flag is set to "true", we complete the table of
        identifiers with the current identifier.
      */
      if(temp_b) {
        temp_identifiers_array[temp_identifiers_array.length] =
          this.__blobMapArray[temp_x][temp_y];
      }
    }
  }
  /*
    The function returns number of processed identifiers.
  */
  return temp_identifiers_array.length;
}