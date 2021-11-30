# qbusMqtt

This is the repository for the Qbus Mqtt client application.
With this application you can communicate with all Qbus CTD controller over an MQTT server.

## How to use
The software requires a tftp client and a MQTT server.
On Linux (raspberry) you can install a tftp client with:
`sudo apt-get install -y tftp`

And if you don't have a MQTT server, we recommand using Mosquitto:
`sudo apt-get install -y mosquitto`

### Setting up Mosquitto
For security reasons, we recommend setting up a user with password on the Mosquitto server. You can create a login with the following command:

`sudo mosquitto_passwd -c /etc/mosquitto/pass <username>`

Then enter and reenter a password.

Next you have to edit the moquitto configuration file to use this passord.
The conf file is located at /etc/mosquitto/mosquitto.conf
  
```
# Place your local configuration in /etc/mosquitto/conf.d/
#
# A full description of the configuration file is at
# /usr/share/doc/mosquitto/examples/mosquitto.conf.gz

pid_file /run/mosquitto/mosquitto.pid

persistence true
persistence_location /var/lib/mosquitto/

log_dest file /var/log/mosquitto/mosquitto.log

include_dir /etc/mosquitto/conf.d

per_listener_settings true
allow_anonymous false
password_file /etc/mosquitto/pass
```
  
Then restart mosquitto to apply the changes:

`sudo systemctl restart mosquitto`

### Setting up Qbus MQTT client
First we need to unzip the tar files:

`tar -xf qbusMqttGw-arm.tar`

Then we create te locations needed for the software:
```
sudo mkdir /usr/bin/qbus
sudo mkdir /opt/qbus
sudo mkdir /var/log/qbus
```

Next, unzip the tar file to that location:

`sudo tar -xf qbusMqttGw-arm.tar`

And copy the files to the correct locations:

```
sudo cp -R qbusMqttGw-arm/fw/ /opt/qbus/
sudo cp qbusMqttGw-arm/puttftp /opt/qbus/
sudo cp qbusMqttGw-arm/qbusMqttGw /usr/bin/qbus/
```
  
To use the client, we recomment to use a service.
Create a new file:

`/lib/systemd/system/qbusmqtt.service`

And enter the following:
```
[Unit]
Description=MQTT client for Qbus communication
After=multi-user.target networking.service

[Service]
ExecStart= /usr/bin/qbus/qbusMqtt/./qbusMqttGw -serial="QBUSMQTTGW" -logbuflevel -1 -log_dir /var/log/qbus -max_log_size=10 -storagedir /opt/qbus -mqttbroker "tcp://localhost:1883" -mqttuser <user> -mqttpassword <password>
PIDFile=/var/run/qbusmqttgw.pid
Restart=on-failure
RemainAfterExit=no
RestartSec=5s

[Install]
WantedBy=multi-user.target
```

Replace <user> and <password> by you mosquitto credentials.

Then we create a logrotation for the service:
  
```
sudo touch /etc/logrotate.d/qbus
echo '/var/log/qbus/*.log {' | sudo tee -a /etc/logrotate.d/qbus
echo '        daily' | sudo tee -a /etc/logrotate.d/qbus
echo '        rotate 7' | sudo tee -a /etc/logrotate.d/qbus
echo '        size 10M' | sudo tee -a /etc/logrotate.d/qbus
echo '        compress' | sudo tee -a /etc/logrotate.d/qbus
echo '        delaycompress' | sudo tee -a /etc/logrotate.d/qbus
```
  
Then reload the servies:

`sudo systemctl daemon-reload`

Enable the qbusmqtt service:

`sudo systemctl enable qbusmqtt.service`
  
Finally start the service:

`sudo systemctl start qbusmqtt.service`

