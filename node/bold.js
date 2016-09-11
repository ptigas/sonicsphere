// Node std
var std_fs = require('fs');

// underscore.js
var _ = require('underscore');

// Express
var express = require('express');

// node-osc
var osc = require('node-osc');

// three.js
var THREE = require('three');

// This program
var sonicsphere = require('./js/sonicsphere.js');
var settings = require('./settings.js');


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
//var aligned = 0;
//var read_intro = false;
var g_teapotPacket_current_receivedByteCount = 0;
var g_teapotPacket_current_receivedBytes = [];
var g_teapotPacket_totalByteCount = 20;

// + Start the web view {{{

// Create an HTTP server that serves the current working directory statically, using Express
var g_webView_app = express();
g_webView_app.use(express.static('.'));
var g_webView_server = require('http').createServer(g_webView_app)

// Also make the HTTP server provide realtime IO sockets (on port whatever), using socket.io
var g_webView_io = require('socket.io')(g_webView_server);

// Tell everyone already listening to the realtime socket that Bluetooth is not (yet) connected
g_webView_io.emit('status', { for: 'everyone', bluetooth_connected: false });

// Start the HTTP server listening on port 3000
g_webView_server.listen(settings.view_port);

/*
function handler(req, res)
{
  std_fs.readFile(__dirname + '/view.html',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }

    res.writeHead(200);
    res.end(data);
  });
}
*/

// + }}}

if (playback)
{
    function _playback()
    {
        std_fs.readFile(playback_file, function (error, data)
        {
            if (error)
                throw error;

            _.map(data.toString(), function (c)
            {
                //sonicsphere_receivePacketChar(c);
                console.log(c);
            });

            _playback();
        });
    }

    _playback();
}
else if (bluetooth_on)
{
    // Import bluetooth serial port module
    var bluetooth_serial_port = require('bluetooth-serial-port');

    // Create BluetoothSerialPort object
    var bluetoothSerialPort = new bluetooth_serial_port.BluetoothSerialPort();

    // Initialize 'data_received' variable which will be set to true by 'data' events.
    // Below, we will initialize it to false, watch it and if it doesn't become true quickly enough,
    // we'll reset and restart from the Bluetooth inquire stage
    var data_received;

    // Install handler to respond to Bluetooth devices that are found
    // then issue the related command to inquire for devices
    bluetoothSerialPort.on('found', function (i_address, i_name)
    {
        console.log(" Found Bluetooth device with name: " + i_name + ", address: " + i_address);

        // If the device's name matches that expected of the Sonicsphere
        if (_.contains(settings.whitelist, i_name))
        {
            // Print address and name
            console.log(" Found Sonicsphere by whitelisted device name: " + i_name + ", address: " + i_address);
            //console.log(" Device name is on Sonicsphere whitelist");

            // Check if the presumed Sonicsphere, at its address, has a serial port service running,
            // and if so get the channel ID of it which we can make an RFCOMM connection back to
            console.log(" Finding serial port service channel...");
            bluetoothSerialPort.findSerialPortChannel(i_address, function (i_channel)
            {
                console.log("  Found serial port service on channel: " + i_channel.toString());

                // Connect to the Sonicsphere on that channel
                console.log("  Connecting to serial port service channel...");
                bluetoothSerialPort.connect(i_address, i_channel, function ()
                // If connected successfully
                {
                    console.log('   Successfully connected to serial port service channel');

                    // Tell everyone listening to the realtime socket that the Sonicsphere is now fully connected
                    g_webView_io.emit('status', { for: 'everyone', bluetooth_connected: true });

                    // Clear teapot packet accumulation buffer
                    g_teapotPacket_current_receivedByteCount = 0;
                    g_teapotPacket_current_receivedBytes = [];
                    //aligned = 0;
                    //read_intro = false;

                    // For each byte received from the Sonicsphere, call sonicsphere_receivePacketChar(),
                    // and also set data_received to true to note for elsewhere in this program that some data is actually coming in
                    // [observation: blue LED lights up on Sonicsphere circuitboard when data is flowing]
                    bluetoothSerialPort.on('data', function (i_buffer)
                    {
                        //console.log("data: " + i_buffer);
                        data_received = true;
                        _.map(i_buffer, sonicsphere_receivePacketChar);
                    });
                },
                // Else if there was a connection error
                function ()
                {
                    console.log('   ERROR: Failed to connect to serial port service channel');
                });

                // "Closes the connection" says the node-bluetooth-serial-port documentation for close();
                // "Close the connection when you're ready" says the node-bluetooth-serial-port example for this line;
                // looks dubious to me putting 'close' here but whatever, follow the example
                bluetoothSerialPort.close();
            },
            // Else if didn't find serial port channel
            function ()
            {
                console.log("  ERROR: This device doesn't appear to have a serial port service channel");
            });
        }
    });
    console.log("Inquiring for Bluetooth devices...");
    bluetoothSerialPort.inquire();

    function sonicsphere_receivePacketChar(i_char)
    // Receive a character of a teapot packet from the Sonicsphere, accumulate in buffer,
    // and if and when we accumulate a full buffer call process_packet()
    {
        // If received a dollar sign, which delimits the start of a teapot packet,
        // reset the received byte count
        // [If you want to remove g_teapotPacket_current_receivedByteCount in favour of g_teapotPacket_current_receivedBytes.length
        //  then remove the line inside this block and add g_teapotPacket_current_receivedBytes = []; ]
        if (i_char == "$".charCodeAt(0))
        {
            g_teapotPacket_current_receivedByteCount = 0;
        }

        // Append the received byte to the accumulation buffer,
        // and if we have a full length of teapot packet, process it
        g_teapotPacket_current_receivedBytes[g_teapotPacket_current_receivedByteCount++] = i_char;
        if (g_teapotPacket_current_receivedByteCount == g_teapotPacket_totalByteCount)
        {
            process_packet(g_teapotPacket_current_receivedBytes);

            // Reset received byte count ready for next packet
            g_teapotPacket_current_receivedByteCount = 0;
        }
    }

    // At regular intervals, if no data was received in the interval, close Bluetooth object and restart
    var CLOSE_AND_REINQUIRE_TIMEOUT_IN_MILLISECONDS = 5000;
    function restartIfNoData()
    {
        // If we haven't had a 'data' event in the last interval since calling this, restart everything,
        // ie. send 'not connected' notifications out, close bluetoothSerialPort and re-inquire for device (hoping again to find Sonicsphere)
        if (!data_received)
        {
            // Show message
            console.log("Too much time passed without a 'data' receipt from a recognized Sonicsphere device - closing Bluetooth");

            // Tell everyone listening to the realtime socket that the Sonicsphere is not fully connected
            g_webView_io.emit('status', { for: 'everyone', bluetooth_connected: false });

            // Close
            bluetoothSerialPort.close();
            //process.exit();

            // Re-inquire for Bluetooth devices
            console.log("Inquiring for Bluetooth devices...");
            bluetoothSerialPort.inquire();
        }

        // Take stock again after some brief number of milliseconds
        data_received = false;
        setTimeout(restartIfNoData, CLOSE_AND_REINQUIRE_TIMEOUT_IN_MILLISECONDS);
    }
    // Take stock after some brief number of milliseconds
    data_received = false;
    setTimeout(restartIfNoData, CLOSE_AND_REINQUIRE_TIMEOUT_IN_MILLISECONDS);
}


//scene = new THREE.Scene();
//scene.add(icosahedron.mesh);

// create Icosahedron
var icosahedron = new sonicsphere.Icosahedron();

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

//
function process_packet(i_packet)
// Params:
//  i_packet:
//   A complete (20 byte) teapot packet.
//   [copy-paste from sonicsphere2.pde:
//    InvenSense Teapot packet format
//     0.b: '$'
//     1.b: 2
//     2.w, big-endian: q[0] in 2.14 fixed point
//     4.w, big-endian: q[1] in 2.14 fixed point
//     6.w, big-endian: q[2] in 2.14 fixed point
//     8.w, big-endian: q[3] in 2.14 fixed point
//     10
//     12.w, little-endian: accel x
//     14.w, little-endian: accel y
//     16.w, little-endian: accel z
//     18.b: '\r'
//     19.b: '\n']
{
    /*
    console.log("process_packet("
                + i_packet[0] + ", " + i_packet[1] +
                ", quaternion: " +
                ((i_packet[2] << 8) | i_packet[3]) / 16384.0 +
                ", " +
                ((i_packet[4] << 8) | i_packet[5]) / 16384.0 +
                ", " +
                ((i_packet[6] << 8) | i_packet[7]) / 16384.0 +
                ", " +
                ((i_packet[8] << 8) | i_packet[9]) / 16384.0 +
                ", ignored bytes 10 & 11: " +
                i_packet[10] + ", " + i_packet[11] +
                ", accel: " +
                to_short((i_packet[13] << 8) | i_packet[12]) +
                ", " +
                to_short((i_packet[15] << 8) | i_packet[14]) +
                ", " +
                to_short((i_packet[17] << 8) | i_packet[16]) +
                ", CR, LF)");
    */

    if (record)
    {
        std_fs.appendFile(record_file, i_packet, function (err)
        {
            if (err)
                console.log(err);
        });
    }

    // + Quaternion {{{

    // Get quaternion from data packet
    var q = [];
    //  w
    q[0] = ((i_packet[2] << 8) | i_packet[3]) / 16384.0;
    //  x
    q[1] = ((i_packet[4] << 8) | i_packet[5]) / 16384.0;
    //  y
    q[2] = ((i_packet[6] << 8) | i_packet[7]) / 16384.0;
    //  z
    q[3] = ((i_packet[8] << 8) | i_packet[9]) / 16384.0;
    for (var i = 0; i < 4; i++)
    {
        if (q[i] >= 2)
            q[i] = -4 + q[i];
    }

    //// Send quaternion raw components in OSC "/quat" message
    //// (commented out because unused)
    //osc_client.send("/quat", q[0], q[1], q[2], q[3], function (err) {});

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

    // Pass quaternion to Icosahedron ray-caster method
    // which rotates an icosahedron using the quaternion
    // then returns the index of which face's centroid is closest to some fixed external point;
    // send this face index number in OSC "/note" message to act as a note number
    var index = icosahedron.rayCasting(new THREE.Quaternion(q[0], q[1], q[2], q[3]));
    print_debug("note: " + index);
    osc_client.send('/note', index, function (err) {});

    // + }}}

    // + Accelerometer {{{

    // Get accelerometer vector from data packet
    var ax = to_short((i_packet[13] << 8) | i_packet[12]);
    var ay = to_short((i_packet[15] << 8) | i_packet[14]);
    var az = to_short((i_packet[17] << 8) | i_packet[16]);

    // Send in OSC "/accel" message
    osc_client.send('/accel', ax, ay, az, function (err) {});

    // + }}}

    // Send both the raw quaternion and accelerometer info out over the socket.io channel to the webview
    g_webView_io.emit('q', { for: 'everyone', a: [ax, ay, az], q: q });
}

function to_short(x)
{
    if (x > 65535/2.0)
        x -= 65535;

    return x;
}
