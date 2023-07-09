#!/bin/bash
cd ~
wget -O ~/.vimrc https://raw.githubusercontent.com/cdk-entest/basic-vim/main/.vimrc 
wget https://github.com/cdk-entest/flask-tailwind-polly/archive/refs/heads/master.zip 
unzip master.zip
cd flask-tailwind-polly-master
python3 -m ensurepip --upgrade
python3 -m pip install -r requirements.txt
cd app
export BUCKET_NAME="vpb-polly-demo-10072023"
export REGION="ap-southeast-1"
python3 -m app 
