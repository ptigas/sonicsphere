var btSerial = new (require('bluetooth-serial-port')).BluetoothSerialPort(),
    _ = require('underscore'),
    osc = require('node-osc'),
    settings = require('./settings.js'),    
    express = require('express'),
    fs = require('fs'),
    THREE = require('three'),
    sonicsphere = require('./js/sonicsphere.js');

// Silly args parsing
var record = false;
var record_file = "";
var playback = false;
var playback_file = "";
var bluetooth_on = true;
var debug = false;
process.argv.forEach(function (val, index, array) {
    if (val == '--record') {
        record_file = array[index+1];
        record = true;
        console.log("recording to file: " + record_file);
    }
    if (val == '--playback') {
        playback_file = array[index+1];
        playback = true;
        console.log("playing back from file: " + playback_file);
    }

    if (val == '--no-bluetooth') {
        console.log('Blutooth turned off')
        bluetooth_on = false;
    }

    if (val == "--debug") {
        debug = true;
    }
});

// simple debug function
function print_debug(msg) {
    if (debug) {
        console.log(msg);
    }
}

// Start the OSC client
var osc_client = new osc.Client(settings.osc.host, settings.osc.port); 

// Globals related to sphere gyro
var serialCount = 0;
var aligned = 0;
var read_intro = false;

var teapotPacket = [];
var packetSize = 20;

// Start the web view
var fs = require('fs');

var app = express();
app.use(express.static('.'));
var server = require('http').createServer(app)
var io = require('socket.io')(server);

server.listen(settings.view_port);

function handler (req, res) {
  fs.readFile(__dirname + '/view.html',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }

    res.writeHead(200);
    res.end(data);
  });
}

// create Icosahedron
var icosahedron = new sonicsphere.Icosahedron();

scene = new THREE.Scene();
scene.add( icosahedron.mesh );

icosahedron.rayCasting();

if (!playback) {
    // Set up the bluetooth

    if (bluetooth_on) {
        var data_received = false;
        btSerial.on('found', function(address, name) {
            if (_.contains(settings.whitelist, name)) {
                console.log(address + " " + name);
                btSerial.findSerialPortChannel(address, function(channel) {
                    btSerial.connect(address, channel, function() {
                        console.log('connected');

                        serialCount = 0;
                        aligned = 0;
                        read_intro = false;
                        teapotPacket = [];

                        btSerial.on('data', function(buffer) {
                            data_received = true;
                            _.map(buffer, align);
                        });
                    }, function () {
                        console.log('cannot connect');
                    });

                    // close the connection when you're ready
                    btSerial.close();
                }, function() {
                    console.log('found nothing');
                });
            }
        });
    } else {

    }

    // Packet alignment
    function align(ch) {        
        if ( !read_intro && ch == "$".charCodeAt(0) ) {
            read_intro = true;
            aligned = 0;
            serialCount = 0;
        }

        if (aligned < 4) {
            // make sure we are properly aligned on a packetSize-byte packet
            if (serialCount == 0) {
                if (ch == "$".charCodeAt(0)) aligned++; else aligned = 0;
            } else if (serialCount == 1) {
                if (ch == 2) aligned++; else aligned = 0;
            } else if (serialCount == packetSize-2) {
                if (ch == "\r".charCodeAt(0)) aligned++; else aligned = 0;
            } else if (serialCount == packetSize-1) {
                if (ch == "\n".charCodeAt(0)) aligned++; else aligned = 0;
            }

            serialCount++;
            if (serialCount == packetSize) serialCount = 0;
        } else {
            if (serialCount > 0 || ch == "$".charCodeAt(0)) {
                teapotPacket[serialCount++] = ch;
                if (serialCount == packetSize) {
                    process_packet(teapotPacket);
                    serialCount = 0;
                }
            }
        }  
    }    

    console.log("searching");
    btSerial.inquire();
    function check_connectivity() {
        if (data_received == false) {        
            console.log("restart.");
            btSerial.close();
            process.exit();
        }
        data_received = false;
        setTimeout(check_connectivity, 1000); // 1 second
    }
    setTimeout(check_connectivity, 1000); // 1 second  
} else {
    _playback();
}

function _playback() {
    fs.readFile(playback_file, function(error, data) {
        if (error) { 
            throw error; 
        }

        _.map(data.toString(), function(c) {
            //align(c);
            console.log(c);
        });        
        _playback();
    });
}

function quaternion_toAxisAngle(i_w, i_x, i_y, i_z)
// From a quaternion, extract the rotation axis and angle of the rotation it represents.
//
// Params:
//  i_w, i_x, i_y, i_z:
//   (float number)
//   The components of the quaternion.
//
// Returns:
//  (array of float number)
//  Has elements:
//   0: Rotation angle in radians
//   1, 2, 3: Rotation axis x, y, z
//
// Converted from:
//  toxiclibs Quaternion toAxisAngle()
//   https://bitbucket.org/postspectacular/toxiclibs/src/44d9932dbc9f9c69a170643e2d459f449562b750/src.core/toxi/geom/Quaternion.java?fileviewer=file-view-default#Quaternion.java-447
{
    var sa = Math.sqrt(1.0 - i_w * i_w);
    if (sa < Number.EPSILON)
        sa = 1.0;
    else
        sa = 1.0 / sa;

    return [Math.acos(i_w) * 2.0,
            i_x * sa,
            i_y * sa,
            i_z * sa];
}

function vec3_rotateAroundAxis(i_vector_x, i_vector_y, i_vector_z,
                               i_axis_x, i_axis_y, i_axis_z, i_theta)
// Rotate a vector around an axis.
//
// Params:
//  i_vector_x, i_vector_y, i_vector_z:
//   (float number)
//   Components of vector to rotate
//  i_axis_x, i_axis_y, i_axis_z:
//   (float number)
//   Components of axis to rotate around
//  i_theta:
//   (float number)
//   Rotation angle in radians
//
// Returns:
//  (array of 3 float numbers)
//  x, y, z components of rotated vector
//
// Converted from:
//  toxiclibs Vec3D rotateAroundAxis()
//   https://bitbucket.org/postspectacular/toxiclibs/src/44d9932dbc9f9c69a170643e2d459f449562b750/src.core/toxi/geom/Vec3D.java?at=default&fileviewer=file-view-default#Vec3D.java-1115
{
    var ux = i_axis_x * i_vector_x;
    var uy = i_axis_x * i_vector_y;
    var uz = i_axis_x * i_vector_z;
    var vx = i_axis_y * i_vector_x;
    var vy = i_axis_y * i_vector_y;
    var vz = i_axis_y * i_vector_z;
    var wx = i_axis_z * i_vector_x;
    var wy = i_axis_z * i_vector_y;
    var wz = i_axis_z * i_vector_z;
    var sinTheta = Math.sin(i_theta);
    var cosTheta = Math.cos(i_theta);
    return [
        (i_axis_x * (ux + vy + wz)
         + (i_vector_x * (i_axis_y * i_axis_y + i_axis_z * i_axis_z) - i_axis_x * (vy + wz)) * cosTheta
         + (-wy + vz) * sinTheta),
        (i_axis_y * (ux + vy + wz)
         + (i_vector_y * (i_axis_x * i_axis_x + i_axis_z * i_axis_z) - i_axis_y * (ux + wz)) * cosTheta
         + (wx - uz) * sinTheta),
        (i_axis_z * (ux + vy + wz)
         + (i_vector_z * (i_axis_x * i_axis_x + i_axis_y * i_axis_y) - i_axis_z * (ux + vy)) * cosTheta
         + (-vx + uy) * sinTheta)];
}

function process_packet(quat) {    
    var q = [];

    if (record) {
        fs.appendFile(record_file, quat, function(err) {
            if (err) {
                console.log(err);
            }        
        });
    }    

    // get quaternion from data packet        
    q[0] = ((quat[2] << 8) | quat[3]) / 16384.0;
    q[1] = ((quat[4] << 8) | quat[5]) / 16384.0;
    q[2] = ((quat[6] << 8) | quat[7]) / 16384.0;
    q[3] = ((quat[8] << 8) | quat[9]) / 16384.0;
    for (i = 0; i < 4; i++) if (q[i] >= 2) q[i] = -4 + q[i];

    //// Send quaternion raw components in OSC "/quat" message
    //// (commented out because unused)
    //osc_client.send("/quat", q[0], q[1], q[2], q[3], function (err) {});

    var ax = to_short((quat[13] << 8) | quat[12]);
    var ay = to_short((quat[15] << 8) | quat[14]);
    var az = to_short((quat[17] << 8) | quat[16]);

    osc_client.send('/accel', ax, ay, az, function (err) {});

    // Get axis and angle of rotation from quaternion
    // and send in OSC "/axis" message
    var axisAngle = quaternion_toAxisAngle(q[0], q[1], q[2], q[3]);
    osc_client.send("/axis", axisAngle[0], -axisAngle[1], axisAngle[3], axisAngle[2], function (err) {});

    // Rotate vec3(-1, 1, 1) around above axis by above angle
    // (kind of... choice of initial vector and sign quirks are copied from the Processing version),
    // then normalize it
    // and send in OSC "/v" message
    // (The Ableton project uses this for pitch bend)
    var vr = vec3_rotateAroundAxis(-1, 1, 1,
                                   -axisAngle[1], axisAngle[3], axisAngle[2],
                                   -axisAngle[0]);
    var vrNorm = Math.sqrt(vr[0]*vr[0] + vr[1]*vr[1] + vr[2]*vr[2]);
    vr[0] /= vrNorm;
    vr[1] /= vrNorm;
    vr[2] /= vrNorm;
    osc_client.send("/v", vr[0], vr[1], vr[2], function (err) {});

    //
    var rotateQuaternion = new THREE.Quaternion(q[0], q[1], q[2], q[3]);    
    var index = icosahedron.rayCasting(rotateQuaternion);

    // map the facet of the icosahedron to a note
    osc_client.send('/note', index, function (err) {});
    
    print_debug("note: " + index);

    io.emit('q', { for: 'everyone', a: [ax, ay, az], q: q});
}

function to_short(x) {
    if (x>65535/2.0) {
        x -= 65535;
    }
    return x;
}