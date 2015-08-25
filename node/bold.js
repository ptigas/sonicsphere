
var btSerial = new (require('bluetooth-serial-port')).BluetoothSerialPort(),
    _ = require('underscore'),
    toxi = require('toxiclibsjs'),
    osc = require('node-osc'),
    settings = require('./settings.js');

// Start the OSC client
var osc_client = new osc.Client(settings.osc.host, settings.osc.port); 

// Globals related to sphere gyro
var serialCount = 0;
var aligned = 0;
var read_intro = false;

var teapotPacket = [];
var packetSize = 20;

// Start the web view
var app = require('http').createServer(handler)
var io = require('socket.io')(app);
var fs = require('fs');

app.listen(settings.view_port);

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

io.on('connection', function (socket) {
  socket.emit('news', { hello: 'world' });
  socket.on('my other event', function (data) {
    console.log(data);
  });
});

// Set up the bluetooth
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

var Quaternion = new toxi.geom.Quaternion();
function process_packet(quat) {
    var q = [];

    // get quaternion from data packet        
    q[0] = ((quat[2] << 8) | quat[3]) / 16384.0;
    q[1] = ((quat[4] << 8) | quat[5]) / 16384.0;
    q[2] = ((quat[6] << 8) | quat[7]) / 16384.0;
    q[3] = ((quat[8] << 8) | quat[9]) / 16384.0;
    for (i = 0; i < 4; i++) if (q[i] >= 2) q[i] = -4 + q[i];


    // set our toxilibs quaternion to new data
    Quaternion.set(q[0], q[1], q[2], q[3]);

    var ax = to_short((quat[13] << 8) | quat[12]);
    var ay = to_short((quat[15] << 8) | quat[14]);
    var az = to_short((quat[17] << 8) | quat[16]);

    //console.log(new Date().getTime() + ": " + ax + " " + ay + " " + az);

    osc_client.send('/accel', ax, ay, az, function (err) {});

    var axis = Quaternion.toAxisAngle();

    //console.log(axis[0] + " " + axis[1] + " " + axis[2]);
    osc_client.send('/note', Math.ceil(axis[0]%7 + axis[1]%7 + axis[2]%7), function (err) {});

    io.emit('q', { for: 'everyone', a: [ax, ay, az], q: q});
}

function to_short(x) {
    if (x>65535/2.0) {
        x -= 65535;
    }
    return x;
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