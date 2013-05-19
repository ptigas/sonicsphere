// I2C device class (I2Cdev) demonstration Processing sketch for MPU6050 DMP output
// 6/20/2012 by Jeff Rowberg <jeff@rowberg.net>
// Updates should (hopefully) always be available at https://github.com/jrowberg/i2cdevlib
//
// Changelog:
//     2012-06-20 - initial release

/* ============================================
I2Cdev device library code is placed under the MIT license
Copyright (c) 2012 Jeff Rowberg

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
===============================================
*/

import processing.serial.*;
import processing.opengl.*;
import toxi.geom.*;
import toxi.processing.*;

import fullscreen.*; 
SoftFullScreen fs; 

import oscP5.*;
import netP5.*;

import controlP5.*;

//////////////////////////
boolean FULLSCREEN = true;
//////////////////////////

boolean sketchFullScreen() {
  return FULLSCREEN;
}

// import UDP library
import hypermedia.net.*;

UDP udp;  // define the UDP object

ControlP5 cp5;

OscP5 oscP5;
NetAddress location;

// NOTE: requires ToxicLibs to be installed in order to run properly.
// 1. Download from http://toxiclibs.org/downloads
// 2. Extract into [userdir]/Processing/libraries
//    (location may be different on Mac/Linux)
// 3. Run and bask in awesomeness

ToxiclibsSupport gfx;

int packetSize = 20;

Serial port = null;                         // The serial port
char[] teapotPacket = new char[packetSize];  // InvenSense Teapot packet
int serialCount = 0;                 // current packet byte position
int aligned = 0;
int interval = 0;

float[] q = new float[4];
Quaternion quat = new Quaternion(1, 0, 0, 0);

float[] gravity = new float[3];
float[] euler = new float[3];
float[] ypr = new float[3];

public void init() {
 // call PApplet.init() to take care of business
 super.init();   
}

Slider2D s;
Slider sax, say, saz;

Textlabel credits;

DropdownList ports;

boolean selected_port = false;

NetAddress remote;

void setup() {    
    size(800, 600, OPENGL);
    
    //frame.setLocation(0,0); //works
    gfx = new ToxiclibsSupport(this);
    
    oscP5 = new OscP5(this, 1123);
    remote = new NetAddress("127.0.0.1", 1123);
    
    
    frame.setBackground(new java.awt.Color(0, 0, 0));
    
    //fs = new SoftFullScreen(this); 
    //fs.setShortcutsEnabled(true);
    
    // setup lights and antialiasing
    lights();
    smooth();
  
    cp5 = new ControlP5(this);
    
    ports = cp5.addDropdownList("Ports")
          .setPosition(10, 42)
          .setSize(150,200)
          ;  

    
    for (int i=0; i<Serial.list().length ;i++) {
      ports.addItem(Serial.list()[i], i);
    }
              
    
    cp5.addTextfield("osc address")
     .setPosition(170+10,30)
     .setSize(100,20)
     ;
     
    cp5.addTextfield("port")
     .setPosition(170+120,30)
     .setSize(60,20)
     ;
     
    cp5.addButton("connected")
     .setValue(0)
     .setPosition(170+190,30)
     .setSize(50,20)
     ;
         
    sax = cp5.addSlider("accel x")
     .setPosition(30, 300)
     .setSize(10,200)
     .setRange(-17000,17000)
     ;
    sax.getCaptionLabel().align(ControlP5.RIGHT, ControlP5.BOTTOM_OUTSIDE).setPaddingX(0);
     
    say = cp5.addSlider("accel y")
     .setPosition(80, 300)
     .setSize(10,200)
     .setRange(-17000,17000)
     ;
    say.getCaptionLabel().align(ControlP5.RIGHT, ControlP5.BOTTOM_OUTSIDE).setPaddingX(0);
    
    saz = cp5.addSlider("accel z")
     .setPosition(130, 300)
     .setSize(10,200)
     .setRange(-17000,17000)
     ;
    saz.getCaptionLabel().align(ControlP5.RIGHT, ControlP5.BOTTOM_OUTSIDE).setPaddingX(0);
     
     cp5.addTextlabel("label")
                    .setText("_+0")
                    .setPosition(600,550)
                    ;
                    
  interval = millis();
}

void controlEvent(ControlEvent e) {
  if (e.isGroup()) {
    /*
    if ( e.getGroup().equals("Ports [DropdownList]") ) {
      println("event from group : "+e.getGroup().getValue()+" from |"+e.getGroup() + "|");
    }
    */
    println("event2 from group : "+e.getGroup().getValue()+" from |"+e.getGroup()+"|");

    if (port != null)
    {    
      port.stop();
    }

    port = new Serial(this, Serial.list()[(int)e.getGroup().getValue()], 115200);
    port.write('r');
  }
}

void serialEvent(Serial port) {    
    int j = 0;
    
    try{
      
    while (port.available() > 0) {
      int ch = port.read();
       
      print((char)ch);
      // wait until you read $. then force align
      if ( !read_intro && ch == '$' ) {
        read_intro = true;
        aligned = 0;
        serialCount = 0;  
      }
      
      if (aligned < 4) {
          // make sure we are properly aligned on a packetSize-byte packet
          if (serialCount == 0) {
              if (ch == '$') aligned++; else aligned = 0;
          } else if (serialCount == 1) {
              if (ch == 2) aligned++; else aligned = 0;
          } else if (serialCount == packetSize-2) {
              if (ch == '\r') aligned++; else aligned = 0;
          } else if (serialCount == packetSize-1) {
              if (ch == '\n') aligned++; else aligned = 0;
          }
          //print((char)ch);
          serialCount++;
          if (serialCount == packetSize) serialCount = 0;
      } else {
          if (serialCount > 0 || ch == '$') {
              teapotPacket[serialCount++] = (char)ch;
              if (serialCount == packetSize) {
                  serialCount = 0; // restart packet byte position                    
                  
                  println(millis()-interval);
                 interval = millis();
                 
                  // get quaternion from data packet
                  q[0] = ((teapotPacket[2] << 8) | teapotPacket[3]) / 16384.0f;
                  q[1] = ((teapotPacket[4] << 8) | teapotPacket[5]) / 16384.0f;
                  q[2] = ((teapotPacket[6] << 8) | teapotPacket[7]) / 16384.0f;
                  q[3] = ((teapotPacket[8] << 8) | teapotPacket[9]) / 16384.0f;
                  for (int i = 0; i < 4; i++) if (q[i] >= 2) q[i] = -4 + q[i];
                  
                  short ax =(short)((teapotPacket[13] << 8) | teapotPacket[12]);
                  short ay =(short)((teapotPacket[15] << 8) | teapotPacket[14]);
                  short az =(short)((teapotPacket[17] << 8) | teapotPacket[16]);
                  
                  OscMessage msg1 = new OscMessage("/accel");
                  msg1.add(ax);
                  msg1.add(ay);
                  msg1.add(az);
                  
                  oscP5.send(msg1, remote);

                  OscMessage msg2 = new OscMessage("/quat");
                  msg2.add(q[0]);
                  msg2.add(q[1]);
                  msg2.add(q[2]);
                  msg2.add(q[3]);
                  
                  oscP5.send(msg2, remote); 
                  
                  sax.setValue(ax);
                  say.setValue(ay);
                  saz.setValue(az);
                  
                  // set our toxilibs quaternion to new data
                  quat.set(q[0], q[1], q[2], q[3]);
              }
          }
      }
    }
    
    } catch (Exception e) {
    println("Initialization exception");
//    decide what to do here
  }
  
}

void draw() {
  /*
    if (millis() - interval > 1000) {
        // resend single character to trigger DMP init/start
        // in case the MPU is halted/reset while applet is running
        port.write('r');
        interval = millis();
    }
    */
    
    // black background
    background(0);
    
    // translate everything to the middle of the viewport
    pushMatrix();
    translate(width / 2, height / 2);

    // 3-step rotation from yaw/pitch/roll angles (gimbal lock!)
    // ...and other weirdness I haven't figured out yet
    //rotateY(-ypr[0]);
    //rotateZ(-ypr[1]);
    //rotateX(-ypr[2]);

    // toxiclibs direct angle/axis rotation from quaternion (NO gimbal lock!)
    // (axis order [1, 3, 2] and inversion [-1, +1, +1] is a consequence of
    // different coordinate system orientation assumptions between Processing
    // and InvenSense DMP)
    
    float[] axis = quat.toAxisAngle();
    rotate(axis[0], -axis[1], axis[3], axis[2]);

    // draw main body in red
    fill(255, 0, 0, 200);
    
    sphereDetail(30, 30);
    sphere(200);
    
    popMatrix();
    lights();
}

boolean read_intro = false;
