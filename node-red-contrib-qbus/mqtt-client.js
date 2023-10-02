var mqtt = require('mqtt');
module.exports = function(RED) {
    function Device(client, id, connectable, ctdSn, outputArray) {
        this.client = client
        this.connectable   = connectable
        this.id = id
        this.ctdSn = ctdSn
        this.outputArray = outputArray
    }

    function Outputs(id, type, name) {
        this.id = id
        this.type = type
        this.name = name
    }

    function Connection(id, connected, connectable) {
        this.id = id;
        this.connected = connected;
        this.connectable = connectable;
    }


    GetDevices = function (devs, client, conn) {
        RED.log.debug("Processing devices ");
        var devices = new Array();
        if (devs != null) {
        for (i = 0; i < devs.length; i++) {
            var functionBlocks = devs[i].functionBlocks;
            var outputs = new Array();
    
            if (devs[i].hasOwnProperty("functionBlocks")){
                //RED.log.debug(JSON.stringify(functionBlocks))
                var fbSize = functionBlocks.length
                if (functionBlocks.length > 0){
                    for (j = 0; j < functionBlocks.length; j++) {
                        switch (functionBlocks[j].type) {
                            case 'analog':
                                outputs.push(new Outputs(functionBlocks[j].id, "analog", functionBlocks[j].name));
                                break;
                            case 'weatherstation':
                                outputs.push(new Outputs(functionBlocks[j].id, "weatherstation", functionBlocks[j].name));
                                break;
                            case 'gauge':
                                outputs.push(new Outputs(functionBlocks[j].id, "gauge", functionBlocks[j].name));
                                break;
                            case 'onoff':
                                outputs.push(new Outputs(functionBlocks[j].id, "onoff", functionBlocks[j].name));
                                break;
                            case 'thermo':
                                outputs.push(new Outputs(functionBlocks[j].id, "thermo", functionBlocks[j].name));
                                break;
                            case 'shutter':
                                if (functionBlocks[j].properties.hasOwnProperty("state")){
                                    // UP/DOWN Type
                                    outputs.push(new Outputs(functionBlocks[j].id, "shutter", functionBlocks[j].name));
                                } else if (functionBlocks[j].properties.hasOwnProperty("shutterPosition")){
                                    // %type
                                    outputs.push(new Outputs(functionBlocks[j].id, "shutter", functionBlocks[j].name));
                                } else if (functionBlocks[j].properties.hasOwnProperty("slatPosition")){
                                    // %type with slats
                                    outputs.push(new Outputs(functionBlocks[j].id, "shutter", functionBlocks[j].name));
                                }
                                break;
                            case 'scene':
                                outputs.push(new Outputs(functionBlocks[j].id, "scene", functionBlocks[j].name));
                                break;
                        }
                    }
                    
                }
            }
            devices.push(new Device(client, devs[i].id, conn, devs[i].serialNr, outputs))
            
        }
        return devices;
    }
    return null;
    };

    class RemoteServerNode {
        constructor(n){
            RED.nodes.createNode(this,n);
            var node = this;
            node.config = n;

            node.host = node.config.host;

            node.on('close', () => this.onClose());
            node.setMaxListeners(0);

            node.mqtt = node.connectMQTT();
            node.mqtt.on('connect', () => this.onMQTTConnect());
            node.mqtt.on('message', (topic, message) => this.onMQTTMessage(topic, message));
            node.mqtt.on('close', () => this.onMQTTClose());
            node.mqtt.on('end', () => this.onMQTTEnd());
            node.mqtt.on('reconnect', () => this.onMQTTReconnect());
            node.mqtt.on('offline', () => this.onMQTTOffline());
            node.mqtt.on('disconnect', (error) => this.onMQTTDisconnect(error));
            node.mqtt.on('error', (error) => this.onMQTTError(error));


            node.globalContext = node.context().global;

            
        }

        

        getConfig(callback, forceRefresh = false, withGroups = false) {
            var node = this;
            var timeout = null;
            var timeout_ms = 60000;
            var client = node.connectMQTT('tmp');
            var conn = false

            client.on('connect', function() {
                //end function after timeout, if no response
                timeout = setTimeout(function() {
                    node.error('Error: getDevices timeout, close connection')
                    client.end(true);
                }, timeout_ms);

                // Subscribe to config topic
                client.subscribe("cloudapp/QBUSMQTTGW/config", {'qos':parseInt(node.config.mqtt_qos||0)}, function(err) {
                    if (err) {
                        node.error('Error code #0023: ' + err);
                        client.end(true);
                    }
                });

                // Subscribe to state topic
                client.subscribe(node.getTopic('/state'), {'qos':parseInt(node.config.mqtt_qos||0)}, function(err) {
                    if (err) {
                        node.error('Error code #0023: ' + err);
                        client.end(true);
                    }
                });
            });

            client.on('error', function(error) {
                node.error('Error code #0024: ' + error);
                client.end(true);
            });

            client.on('end', function(error, s) {
                clearTimeout(timeout);
            });

            client.on('message', function(topic, message) {
                if (node.getTopic('/state') === topic) {
                    //node.log("Initial state: " + message)
                } else if (topic.includes("/state")) {
                    //node.log("Connection state: " + message)
                    obj = JSON.parse(message)
                    var id = obj.id
                    var conn = obj.properties.connectable


                    var devices = node.globalContext.get("devices")

                    for (j = 0; j < devices.length; j++) {
                        //console.log(devices[j].connected)
                        if (devices[j].id == id) {
                            devices[j].connectable = conn
                        }
                    }
                    node.globalContext.set("devices",devices)

                    
                     client.end(true);
                } else if (node.getTopic('/config') === topic) {
                    // Handle config message
                    var obj = {}
                    try {
                        obj = JSON.parse(message)
                    } catch (error) {
                        node.error("Not a json object")
                    }

                    if (obj.hasOwnProperty("devices") ){
                        var devices = GetDevices(obj.devices, node.name, conn)
                        node.globalContext.set("devices",devices)
                        var i = 0
                        var devs = []

                        // Subscribe to state topic for all controllers
                        for (i = 0; i < devices.length; i++) {
                            devs.push(devices[i].id)
                            client.subscribe("cloudapp/QBUSMQTTGW/" + devices[i].id + "/state", {'qos':parseInt(node.config.mqtt_qos||0)}, function(err) {
                                if (err) {
                                    node.error('Error code #0023: ' + err);
                                    client.end(true);
                                }
                            });
                        }

                        // Get state of all controllers
                        var devString = JSON.stringify(devs);
                        client.publish(node.getTopic('/getState'), devString, {'qos':parseInt(0)},function(err) {
                            if (err) {
                                node.error(err);
                            }
                        });
                    }
                }
            });

            // Request config message
            client.publish("cloudapp/QBUSMQTTGW/getConfig", "", {'qos':parseInt(0)},function(err) {
                if (err) {
                    node.error(err);
                }
            });
        }

        connectMQTT(clientId = null) {
            var node = this;
            var options = {
                port: node.config.mqtt_port || 1883,
                username: node.config.mqtt_username || null,
                password: node.config.mqtt_password || null,
                clientId: 'NodeRed-' + node.id + '-' + (clientId ? clientId : (Math.random() + 1).toString(36).substring(7)),
            };

            var baseUrl = 'mqtt://';

            var tlsNode = RED.nodes.getNode(node.config.tls);
            if (node.config.usetls && tlsNode) {
                tlsNode.addTLSOptions(options);
                baseUrl = 'mqtts://';
            }

            return mqtt.connect(baseUrl + node.config.host, options);
        }

        onMQTTConnect() {
            var node = this;
            node.connection = true;
            // node.log('MQTT Connected');
            node.emit('onMQTTConnect');
            
            node.getConfig(() => {
                node.subscribeMQTT("/#");
            });
            
        }

        subscribeMQTT(topic) {
            var node = this;
            node.mqtt.subscribe(topic, {'qos':0}, function(err) {
                if (err) {
                    node.log('MQTT Error: Subscribe to ' + topic);
                    node.emit('onConnectError', err);
                } 
            });
        }

        publishMQTT(topic,payload) {
            var node = this;
            node.mqtt.publish(topic, JSON.stringify(payload));
        }

        unsubscribeMQTT() {
            var node = this;
            //node.log('MQTT Unsubscribe from mqtt topic: #');
            node.mqtt.unsubscribe(node.getTopic('/#'), function(err) {});
            node.devices_values = {};
        }

        onMQTTDisconnect(error) {
            var node = this;
            node.log('Disconnected from ' + node.name);
            console.log(error);
        }

        onMQTTError(error) {
            var node = this;
            node.log('MQTT Error for ' + node.name);
            node.emit('onConnectError', error);
        }

        onMQTTOffline() {
            var node = this;
            node.warn('No connection with MQTT server ' + node.name + ', please check your settings.');
            node.emit('onConnectError', "MQTT server offline");
        }

        onMQTTEnd() {
            var node = this;
            //node.log('MQTT End');
        }

        onMQTTReconnect() {
            var node = this;
            node.log('Trying to connect to ' + node.name);
        }

        onMQTTClose() {
            var node = this;
            // node.log('MQTT Closed for ', node.host);
            node.emit('onConnectError', "Connection closed to MQTT server");
        }

        onClose() {
            var node = this;
            node.unsubscribeMQTT();
            node.mqtt.end();
            node.mqtt.close();
            node.connection = false;
            node.emit('onClose');
            node.log('MQTT connection closed for ' + node.name);
        }

        onMQTTMessage(topic, message) {
            var node = this;
            var messageString = message.toString();
            var msg2send = {}
            msg2send.topic = topic;
            msg2send.payload = messageString;
            node.emit('onMQTTMessage', msg2send);
            
        }

        getBaseTopic() {
            return "cloudapp/QBUSMQTTGW";
        }

        getTopic(path) {
            return this.getBaseTopic() + path;
        }
    }

   RED.nodes.registerType("mqtt-client",RemoteServerNode);
}