
var myCapture, // camera
    myVida;    // VIDA


var synth = [];
function initCaptureDevice() {
  try {
    myCapture = createCapture(VIDEO);
    myCapture.size(320, 240);
    myCapture.elt.setAttribute('playsinline', '');
    myCapture.hide();
    console.log(
      '[initCaptureDevice] capture ready. Resolution: ' +
      myCapture.width + ' ' + myCapture.height
    );
  } catch(_err) {
    console.log('[initCaptureDevice] capture error: ' + _err);
  }
}

function setup() {
  createCanvas(640, 480); // we need some space...
  initCaptureDevice(); // and access to the camera
  myVida = new Vida(this); // create the object
  myVida.progressiveBackgroundFlag = true;
  myVida.imageFilterFeedback = 0.92;
  myVida.imageFilterThreshold = 0.15;

 /*
    You may need a horizontal image flip when working with the video camera.
    If you need a different kind of mirror, here are the possibilities:
      [your vida object].MIRROR_NONE
      [your vida object].MIRROR_VERTICAL
      [your vida object].MIRROR_HORIZONTAL
      [your vida object].MIRROR_BOTH
    The default value is MIRROR_NONE.
  */

  myVida.mirror = myVida.MIRROR_HORIZONTAL;
  myVida.handleActiveZonesFlag = true;
  myVida.setActiveZonesNormFillThreshold(0.02);

  var padding = 0.2; //default 0.07
  var n = 3; //default 5
  var zoneWidth = 0.1;
  var zoneHeight = 0.7;
  var hOffset = (1.0 - (n * zoneWidth + (n - 1) * padding)) / 2.0;
  var vOffset = 0.25;
  for(var i = 0; i < n; i++) {
    myVida.addActiveZone(
      i,
      hOffset + i * (zoneWidth + padding), vOffset, zoneWidth, zoneHeight,
    );
    var osc = new p5.Oscillator();
    osc.setType('sine');
    osc.freq(440.0 * Math.pow(2.0, (60 + (i * 4) - 69.0) / 12.0));
    osc.amp(0.0); osc.start();
    synth[i] = osc;
  }

  frameRate(30); // set framerate
}

function draw() {
  if(myCapture !== null && myCapture !== undefined) { // safety first
    background(0, 0, 255);
    
    myVida.update(myCapture);
    image(myVida.currentImage, 0, 0);
    image(myVida.backgroundImage, 320, 0);
    image(myVida.differenceImage, 0, 240);
    image(myVida.thresholdImage, 320, 240);
    // let's also describe the displayed images
    noStroke(); fill(255, 255, 255);
    text('camera', 20, 20);
    text('progressive background image', 340, 20);
    text('difference image', 20, 260);
    text(' threshold image', 340, 260);
    
    // defint size of the drawing
    var temp_drawing_w = width / 2;  var temp_drawing_h = height / 2; 
    // offset from the upper left corner
    var offset_x = 320; var offset_y = 240;
    // pixel-based zone's coords
    var temp_x, temp_y, temp_w, temp_h;
    push(); // store current drawing style and font
    translate(offset_x, offset_y); // translate coords
    // set text style and font
    textFont('Helvetica', 10); textAlign(LEFT, BOTTOM); textStyle(NORMAL);
    // let's iterate over all active zones
    for(var i = 0; i < myVida.activeZones.length; i++) {
      // read and convert norm coords to pixel-based
      temp_x = Math.floor(myVida.activeZones[i].normX * temp_drawing_w);
      temp_y = Math.floor(myVida.activeZones[i].normY * temp_drawing_h);
      temp_w = Math.floor(myVida.activeZones[i].normW * temp_drawing_w);
      temp_h = Math.floor(myVida.activeZones[i].normH * temp_drawing_h);
      // draw zone rect (filled if movement detected)
      strokeWeight(1);
      if(myVida.activeZones[i].isEnabledFlag) {
        stroke(255, 0, 0);
        if(myVida.activeZones[i].isMovementDetectedFlag) fill(255, 0, 0, 128);
        else noFill();
      }
      else {
        stroke(0, 0, 255);
        if(myVida.activeZones[i].isMovementDetectedFlag) fill(0, 0, 255, 128);
        else noFill();
      }
      rect(temp_x, temp_y, temp_w, temp_h);
      // print id
      noStroke();
      if(myVida.activeZones[i].isEnabledFlag) fill(255, 0, 0);
      else fill(0, 0, 255);
      text(myVida.activeZones[i].id, temp_x, temp_y - 1);
     
      if(myVida.activeZones[i].isChangedFlag) {
        // print zone id and status to console ... 
      //  console.log('zone: ' + myVida.activeZones[i].id +' status: ' + myVida.activeZones[i].isMovementDetectedFlag);

       document.getElementById("line1").value='zone: ' + myVida.activeZones[0].id +
     ' status: ' + myVida.activeZones[0].isMovementDetectedFlag;
        document.getElementById("line2").value='zone: ' + myVida.activeZones[1].id +
        ' status: ' + myVida.activeZones[1].isMovementDetectedFlag;
        document.getElementById("line3").value='zone: ' + myVida.activeZones[2].id +
        ' status: ' + myVida.activeZones[2].isMovementDetectedFlag;

        
        var a = document.getElementById("line1").value;
        var b = document.getElementById('line2').value;
        var c = document.getElementById('line3').value;
     
        var db = firebase.database();
        var ref = db.ref("speed/");
        var speed1 = ref.child('data1');  
        var speed2 = ref.child('data2');
        var speed3 =ref.child('data3'); 

        speed1.set( a);
        speed2.set( b);
        speed3.set( c);
      
      



      /*
      `
        document.getElementById("line4").value='zone: ' + myVida.activeZones[3].id +
        ' status: ' + myVida.activeZones[3].isMovementDetectedFlag;
        document.getElementById("line5").value='zone: ' + myVida.activeZones[4].id +
        ' status: ' + myVida.activeZones[4].isMovementDetectedFlag;
      */
        //... and use this information to control the sound.
        synth[myVida.activeZones[i].id].amp(
          0.1 * myVida.activeZones[i].isMovementDetectedFlag
        );
       
        
        


      }
    }
  

    pop(); // restore memorized drawing style and font
  }
  else {
    background(255, 0, 0);
  }
}


