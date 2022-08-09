#!/bin/bash
cd ~
wget https://github.com/entest-hai/alb-asg-demo/archive/refs/heads/main.zip
unzip main.zip
cd alb-asg-demo-main
cd web
python3 -m pip install -r requirements.txt
python3 -m app