#!/bin/bash
cd ~
wget https://github.com/cdk-entest/eks-cdk-web/archive/refs/heads/master.zip
unzip master.zip
cd eks-cdk-web-master/webapp
python3 -m ensurepip --upgrade
python3 -m pip install -r requirements.txt
python3 -m app
