# export account id
export ACCOUNT_ID=805614989404
# export region 
export REGION=ap-southeast-1
# install docker
yes | dnf install docker
# start docker
systemctl start docker
# kill running containers
# docker kill $(docker ps -q)
# delete all existing images 
# yes | docker system prune -a
# auth ecr 
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com
# pull and run 
docker pull $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/next-diffusion-app:latest
# run docker image 
docker run -d -p 80:3000 $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/next-diffusion-app:latest
# debug 
# sudo docker exec -it sad_hellman /bin/bash
# sudo docker exec -it sad_hellman /bin/sh
# sudo docker run -d -p 3000:3000 $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/next-diffusion-app:latest