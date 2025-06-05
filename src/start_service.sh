#!/bin/bash


#############
# FUNCTIONS #
#############

build_sif() {
	apptainer build "${SIF_PATH}" "${IMAGE_TAG}"
}

start_instance() {
	apptainer instance start "${SIF_PATH}" "${INSTANCE_NAME}"
}

end_instance() {
	apptainer instance stop "${INSTANCE_NAME}"
}

exec_command() {
	apptainer exec instance://"${INSTANCE_NAME}" $1
}

create_timestamp() {
	local used_timestamp="${1}"
	[ -z "${used_timestamp}" ] && used_timestamp=$(date +"%4Y_%m_%d@%H_%M_%S")
	echo "${used_timestamp}"
}

ctrl_c() {
	#clean up operations for ctrl+c termination
	end_instance
}


#############
#   SETUP   #
#############

SCRIPT_LOCATION=$(realpath "$0")
WORK_LOCATION=$(dirname "$SCRIPT_LOCATION")

LOG_TAG=$(create_timestamp "$1")
LOGFILE_SCRIPT="${WORK_LOCATION}/.logs/service_boot@${LOG_TAG}.log"
LOGFILE_SERVICE="${WORK_LOCATION}/.logs/service_output@${LOG_TAG}.log"
[ ! -d "${WORK_LOCATION}/.logs" ] && mkdir "${WORK_LOCATION}/.logs"
[ ! -d "${WORK_LOCATION}/sifs" ] && mkdir "${WORK_LOCATION}/sifs"
touch "${LOGFILE_SCRIPT}" ; touch "${LOGFILE_SERVICE}"
exec 4> "${LOGFILE_SCRIPT}"
BASH_XTRACEFD=4
set -x

SIF_PATH="${WORK_LOCATION}/sifs/ollama.sif"
IMAGE_TAG="docker://ollama/ollama"
INSTANCE_NAME="ollama_instance"


#############
#   START   #
#############

[ ! -f "${SIF_PATH}" ] && build_sif
trap ctrl_c INT
start_instance && sleep 3
(
    exec_command "ollama serve" &>> "${LOGFILE_SERVICE}"
)