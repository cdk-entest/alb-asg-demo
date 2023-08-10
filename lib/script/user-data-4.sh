# export account id
export ACCOUNT_ID=459688032609
# export region 
export REGION=ap-southeast-1
# kill running containers
docker kill $(docker ps -q)
# delete all existing images 
yes | docker system prune -a
# install docker
yes | dnf install docker
# start docker
systemctl start docker
# auth ecr 
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin .dkr.ecr.$REGION.amazonaws.com
# pull and run 
docker pull $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/next-app:latest
# run docker image 
docker run -d -p 80:3000 $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/next-app:latest