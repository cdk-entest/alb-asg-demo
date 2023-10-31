#!/bin/bash
cd ~
wget https://github.com/cdk-entest/flask-tailwind-polly/archive/refs/heads/master.zip
unzip master.zip
cd flask-tailwind-polly-master
python3 -m ensurepip --upgrade
python3 -m pip install -r requirements.txt
cd app
export BUCKET_NAME="nicv-demo-02112023"
export REGION="ap-southeast-1"
python3 -m app