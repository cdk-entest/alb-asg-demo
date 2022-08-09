from flask import Flask

app = Flask(__name__, static_url_path="", static_folder="static")


@app.route("/")
def hello_world():
    return app.send_static_file("index.html")


if __name__ == "__main__":
    # fetch_data()
    app.run(host="0.0.0.0", port=80)
