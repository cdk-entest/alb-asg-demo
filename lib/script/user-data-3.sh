#!/bin/bash
# # kill -9 $(lsof -t -i:8080)
cd ~
# download vim configuration 
wget -O ~/.vimrc https://raw.githubusercontent.com/cdk-entest/basic-vim/main/.vimrc 
# download web app
wget https://github.com/cdk-entest/flask-tailwind-polly/archive/refs/heads/master.zip 
unzip master.zip
cd flask-tailwind-polly-master
# install pip 
python3 -m ensurepip --upgrade
# install dependencies 
python3 -m pip install -r requirements.txt
cd app
# export bucket name for polly app
export BUCKET_NAME="vpb-polly-demo-10072023"
# export region for polly app
export REGION="ap-southeast-1"
python3 -m app 
