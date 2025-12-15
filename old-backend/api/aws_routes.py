import os
import boto3
import time
from flask import Blueprint, request, jsonify
from ..models import db, User, Post


aws_routes = Blueprint("aws", __name__)

UPLOAD_FOLDER = 'uploads'
BUCKET = 'isntgram'


@aws_routes.route('/<id>', methods=["POST"])
def upload(id):
    if request.method == "POST":
        f = request.files['file']
        f.filename = change_name(f.filename)
        upload_file(f, BUCKET)
        user = User.query.filter(User.id == id).first()
        user.profile_image_url = f'https://isntgram.s3.us-east-2.amazonaws.com/{f.filename}'
        db.session.commit()
        return {"img": f'https://isntgram.s3.us-east-2.amazonaws.com/{f.filename}'}


@aws_routes.route('/post/<current_user_id>/<content>', methods=["POST"])
def upload_post(current_user_id, content):
    f = request.files['file']
    f.filename = change_name(f.filename)
    upload_file(f, BUCKET)
    image_url = f'https://isntgram.s3.us-east-2.amazonaws.com/{f.filename}'
    if content == 'null':
      content = ''

    try:
        post = Post(user_id=current_user_id, image_url=image_url, caption=content)
        db.session.add(post)
        db.session.commit()
        post_dict = post.to_dict()
        return post_dict
    except AssertionError as message:
        return jsonify({"error": str(message)}), 400

    return post.to_dict()


def upload_file(file, bucket):
    """
    Function to upload a file to an S3 bucket
    """
    object_name = file.filename
    s3_client = boto3.client('s3')
    response = s3_client.upload_fileobj(file, bucket, object_name)
    return response


def change_name(file_name):
    return f"{time.ctime().replace(' ', '').replace(':', '')}.png"
