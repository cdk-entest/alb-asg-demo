#!/bin/bash
cd ~
mkdir web 
cd web 
aws s3 cp s3://haimtran-workspace/pub-ec2-web.zip . 
unzip pub-ec2-web.zip
sudo python3 -m pip install -r requirements.txt 
sudo python3 app.py