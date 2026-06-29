FROM ros:humble-ros-base

SHELL ["/bin/bash", "-c"]

RUN apt-get update && apt-get install -y \
    python3-colcon-common-extensions \
    nano \
    python3-flask \
    python3-flask-cors \
    python3-pip \
    curl \
    ca-certificates \
    gnupg

RUN python3 -m pip install flask-cors

WORKDIR /workspace

CMD ["bash"]