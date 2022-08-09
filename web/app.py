import socket
from flask import Flask, render_template

app = Flask(
    __name__, static_url_path="", static_folder="static", template_folder="template"
)


@app.route("/")
def hello_world():
    return app.send_static_file("index.html")


@app.route("/host")
def get_host():
    host = socket.gethostname()
    return render_template("host.html", host=host)


if __name__ == "__main__":
    # fetch_data()
    app.run(host="0.0.0.0", port=80)
