// Sonicsphere 
// 6/20/2012 by Jeff Rowberg <jeff@rowberg.net>
// 1/1/2014 by Panagiotis Tigas <ptigas@gmail.com>

/* ============================================
   Sonicsphere code is placed under the MIT license
   Copyright (c) 2014 Panagiotis Tigkas
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

import processing.net.*; 
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
boolean FULLSCREEN = false;
//////////////////////////

boolean sketchFullScreen() {
    return FULLSCREEN;
}

Client bluetooth;

ControlP5 cp5;

OscP5 oscP5;
NetAddress location;

// NOTE: requires ToxicLibs to be installed in order to run properly.
// 1. Download from http://toxiclibs.org/downloads
// 2. Extract into [userdir]/Processing/libraries
//    (location may be different on Mac/Linux)
// 3. Run and bask in awesomeness

ToxiclibsSupport gfx;

Icosahedron ico;

int packetSize = 20;

Serial port = null;                         // The serial port
char[] teapotPacket = new char[packetSize];  // InvenSense Teapot packet
int serialCount = 0;                 // current packet byte position
int aligned = 0;
int interval = 0;

float[] q = new float[4];
Quaternion quat = new Quaternion(1, 0, 0, 0);

Vec3D V = new Vec3D(-1, 1, 1);

float[] gravity = new float[3];
float[] euler = new float[3];
float[] ypr = new float[3];

public void init() {
    // call PApplet.init() to take care of business
    super.init();   
}

Slider2D s;
Slider sax, say, saz;
Button status;
Textfield osc_port;

Textlabel credits;

DropdownList ports;

boolean selected_port = false;

NetAddress remote;
NetAddress wekinator_remote;

int default_port = 11234;

void setup() {    
    size(800, 600, OPENGL);

    gfx = new ToxiclibsSupport(this);

    oscP5 = new OscP5(this, default_port);
    remote = new NetAddress("127.0.0.1", default_port);
    wekinator_remote = new NetAddress("127.0.0.1", 6448);

    frame.setBackground(new java.awt.Color(0, 0, 0));

    smooth();

    cp5 = new ControlP5(this);

    ports = cp5.addDropdownList("Ports")
        .setPosition(10, 42)
        .setSize(150,200)
        ;  

    for (int i=0; i<Serial.list().length ;i++) {
        ports.addItem(Serial.list()[i], i);
    }

    osc_port = cp5.addTextfield("port")
        .setPosition(170+20,30)
        .setSize(60,20)
        .setText(""+default_port)
        ;

    status = cp5.addButton("SAVE")
        .setValue(0)
        .setPosition(170+100,30)
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

    ico = new Icosahedron(200);
    vr = V;
    
    bluetooth = new Client(this, "127.0.0.1", 5555); 
    thread("read_bluetooth");
}

Vec3D vr;

void read_bluetooth() {
    int j = 0;

    while(true)
    {
    if (bluetooth.available() > 0) { 
            int ch = bluetooth.read();
            // print((char)ch);
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

                        // get quaternion from data packet
                        q[0] = ((teapotPacket[2] << 8) | teapotPacket[3]) / 16384.0f;
                        q[1] = ((teapotPacket[4] << 8) | teapotPacket[5]) / 16384.0f;
                        q[2] = ((teapotPacket[6] << 8) | teapotPacket[7]) / 16384.0f;
                        q[3] = ((teapotPacket[8] << 8) | teapotPacket[9]) / 16384.0f;
                        for (int i = 0; i < 4; i++) if (q[i] >= 2) q[i] = -4 + q[i];

                        // set our toxilibs quaternion to new data
                        quat.set(q[0], q[1], q[2], q[3]);

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

                        OscMessage msg3 = new OscMessage("/axis");
                        float[] axis = quat.toAxisAngle();
                        msg3.add( axis[0] );
                        msg3.add( -axis[1] );
                        msg3.add( axis[3] );
                        msg3.add( axis[2] ); 
                        oscP5.send(msg3, remote);

                        sax.setValue(ax);
                        say.setValue(ay);
                        saz.setValue(az);

                        OscMessage msg4 = new OscMessage("/v");

                        vr = V.getRotatedAroundAxis(new Vec3D(-axis[1], axis[3], axis[2]), -axis[0]).getNormalized();                 
                        msg4.add( vr.x );
                        msg4.add( vr.y );
                        msg4.add( vr.z );
                        oscP5.send(msg4, remote);
                    }
                }
            }
        }
    }
}

ArrayList points = new ArrayList();
ArrayList triangles = new ArrayList();

void draw() {  
  
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

    stroke(255);

    float[] axis = quat.toAxisAngle();
    rotate(axis[0], -axis[1], axis[3], axis[2]);    

    // draw main body in red
    fill(255, 0, 0, 200);

    beginShape();
    vertex(0, 0, 0);
    vertex(vr.x*500, vr.y*500, vr.z*500);
    endShape();

    //sphereDetail(30, 30);
    //sphere(200);    
    ico.create(vr);

    popMatrix();
    lights();
}

boolean read_intro = false;



class Icosahedron extends Shape3D{  
    float phi;
    float radius = 300, length;

    float ry,rz;
    boolean showNums = false, showGUI = false, showTris = true, showQuads = false;

    float[][] vertices;

    // these are indices into the vertices array
    int[][] triangles ;

    // constructor
    Icosahedron(float radius){
        length = radius / 0.951056163;
        phi = (1 + sqrt(5)) / 2; // = 1.6180339887, golden ratio
        init();
    }

    Icosahedron(PVector v, float radius){
        super(v);
        length = radius / 0.951056163;
        phi = (1 + sqrt(5)) / 2; // = 1.6180339887, golden ratio
        init();
    }

    // calculate geometry
    void init(){
        vertices = new float[][] {
            new float[] {  length/2, (-phi*length)/2, 0 }, //0
                new float[] { -length/2, (-phi*length)/2, 0 },
                new float[] { -length/2, ( phi*length)/2, 0 },
                new float[] {  length/2, ( phi*length)/2, 0 },

                new float[] { 0,  length/2, (-phi*length)/2 }, // 4
                new float[] { 0, -length/2, (-phi*length)/2 },
                new float[] { 0, -length/2, ( phi*length)/2 },
                new float[] { 0,  length/2, ( phi*length)/2 },

                new float[] { (-phi*length)/2, 0,  length/2 }, // 8
                new float[] { (-phi*length)/2, 0, -length/2 },
                new float[] { ( phi*length)/2, 0, -length/2 },
                new float[] { ( phi*length)/2, 0,  length/2 }

        };

        // these are indices into the vertices array
        triangles = new int[][]
        {
            new int[]{ 0, 1, 6 },
                new int[]{ 0, 6, 11 },
                new int[]{ 0, 11, 10 },
                new int[]{ 0, 10, 5 },
                new int[]{ 0, 5, 1 },

                new int[]{ 1, 8, 6 },
                new int[]{ 8, 6, 7 },
                new int[]{ 6, 7, 11 },
                new int[]{ 7, 11, 3 },
                new int[]{ 11, 3, 10 },
                new int[]{ 3, 10, 4 },
                new int[]{ 10, 4, 5 },
                new int[]{ 4, 5, 9 },
                new int[]{ 5, 9, 1 },
                new int[]{ 9, 1, 8 },

                new int[]{ 2, 8, 7 },
                new int[]{ 2, 7, 3 },
                new int[]{ 2, 3, 4 },
                new int[]{ 2, 4, 9 },
                new int[]{ 2, 9, 8 }        
        };

    }

    // draws icosahedron 
    void create(Vec3D ray){
        int it = 0;
        int t;
        float cx=0, cy=0, cz=0;

        float min_i = 0;
        float min_d = 100000000;
        for ( int i = 0; i < triangles.length; i++ )
        {
            t = triangles[i][0];          
            cx = vertices[t][0];
            cy = vertices[t][1];
            cz = vertices[t][2];

            t = triangles[i][2];          
            cx += vertices[t][0];
            cy += vertices[t][1];
            cz += vertices[t][2];

            t = triangles[i][1];          
            cx += vertices[t][0];
            cy += vertices[t][1];
            cz += vertices[t][2];

            float[] sc = cartesian2spherical( cx/3, cy/3, cz/3 );
            float[] xyz = spherical2cartesian( sc[0], sc[1], radius );

            d = sqrt( (cx/3-ray.x)*(cx/3-ray.x) + 
                    (cy/3-ray.y)*(cy/3-ray.y) + 
                    (cz/3-ray.z)*(cz/3-ray.z) );
            if ( d < min_d )
            {
                min_d = d;
                min_i = i;
            }
        }

        cx=0; cy=0; cz=0;
        for ( int i = 0; i < triangles.length; i++ )
        {
            beginShape( TRIANGLES );

            if ( i == min_i )
            {
                fill(255, 255, 0, 200);
                
                OscMessage msg1 = new OscMessage("/note");
                msg1.add(i);                
                oscP5.send(msg1, remote);                
            } else {
                fill(255, 0, 0, 200);              
            }

            t = triangles[i][0];
            vertex(vertices[t][0], vertices[t][1], vertices[t][2]);
            cx = vertices[t][0];
            cy = vertices[t][1];
            cz = vertices[t][2];

            t = triangles[i][2];
            vertex(vertices[t][0], vertices[t][1], vertices[t][2]);
            cx += vertices[t][0];
            cy += vertices[t][1];
            cz += vertices[t][2];

            t = triangles[i][1];
            vertex(vertices[t][0], vertices[t][1], vertices[t][2]);
            cx += vertices[t][0];
            cy += vertices[t][1];
            cz += vertices[t][2];



            endShape();

            float[] sc = cartesian2spherical( cx/3, cy/3, cz/3 );
            float[] xyz = spherical2cartesian( sc[0], sc[1], radius );
            line( cx/3, cy/3, cz/3, xyz[0], xyz[1], xyz[2] );
            normal( cx/3, cy/3, cz/3 );
        }
        
        fill(255, 0, 0, 200);
    }
}


class Triangle {
    PVector a, b, c;
    Triangle(PVector a, PVector b, PVector c)
    {
        this.a = a;
        this.b = b;
        this.c = c;
    }

    Triangle3D ToTriangle3D()
    {
        Triangle3D t = new Triangle3D();
        t.set(
                new Vec3D(a.x, a.y, a.z),
                new Vec3D(b.x, b.y, b.z),
                new Vec3D(c.x, c.y, c.z)
             );
        return t;
    }
}

abstract class Shape3D{
    float x, y, z;
    float w, h, d;

    Shape3D(){
    }

    Shape3D(float x, float y, float z){
        this.x = x;
        this.y = y;
        this.z = z;
    }

    Shape3D(PVector p){
        x = p.x;
        y = p.y;
        z = p.z;
    }


    Shape3D(Dimension3D dim){
        w = dim.w;
        h = dim.h;
        d = dim.d;
    }

    Shape3D(float x, float y, float z, float w, float h, float d){
        this.x = x;
        this.y = y;
        this.z = z;
        this.w = w;
        this.h = h;
        this.d = d;
    }

    Shape3D(float x, float y, float z, Dimension3D dim){
        this.x = x;
        this.y = y;
        this.z = z;
        w = dim.w;
        h = dim.h;
        d = dim.d;
    }

    Shape3D(PVector p, Dimension3D dim){
        x = p.x;
        y = p.y;
        z = p.z;
        w = dim.w;
        h = dim.h;
        d = dim.d;
    }

    void setLoc(PVector p){
        x=p.x;
        y=p.y;
        z=p.z;
    }

    void setLoc(float x, float y, float z){
        this.x=x;
        this.y=y;
        this.z=z;
    }


    // override if you need these
    void rotX(float theta){
    }

    void rotY(float theta){
    }

    void rotZ(float theta){
    }


    // must be implemented in subclasses
    abstract void init();
    abstract void create(Vec3D ray);
}

class Dimension3D{
    float w, h, d;

    Dimension3D(float w, float h, float d){
        this.w=w;
        this.h=h;
        this.d=d;
    }
}

// as explained here:
// http://www.math.montana.edu/frankw/ccp/multiworld/multipleIVP/spherical/body.htm
float[] cartesian2spherical ( float x, float y, float z )
{
    float r = sqrt( x*x + y*y + z*z );
    float s = sqrt( x*x + y*y );

    double phi = Math.acos( z / r );
    double theta = Math.asin( y / s );
    if ( x < 0 ) theta = PI - theta;

    return new float[]{ (float)phi, (float)theta };
}

// again:
// http://www.math.montana.edu/frankw/ccp/multiworld/multipleIVP/spherical/body.htm
float[] spherical2cartesian ( float phi, float theta, float radius )
{
    return new float[]{ radius * sin(phi) * cos(theta),
        radius * sin(phi) * sin(theta),
        radius * cos(phi) };
}
