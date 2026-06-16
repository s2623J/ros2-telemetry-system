import json
import threading

import rclpy

from flask import Flask, jsonify
from rclpy.node import Node
from std_msgs.msg import String


app = Flask(__name__)

latest_telemetry = {
    "message": "No telemetry yet"
}


class TelemetryBridge(Node):

    def __init__(self):
        super().__init__('telemetry_bridge')

        self.subscription = self.create_subscription(
            String,
            'telemetry',
            self.listener_callback,
            10
        )

        self.get_logger().info('Telemetry Bridge Started')

    def listener_callback(self, msg):
        global latest_telemetry

        latest_telemetry = json.loads(msg.data)

        self.get_logger().info(
            f'Bridge Received: {msg.data}'
        )


@app.route('/telemetry')
def telemetry():
    return jsonify(latest_telemetry)


def run_flask():
    app.run(
        host='0.0.0.0',
        port=5000
    )


def main(args=None):
    rclpy.init(args=args)

    node = TelemetryBridge()

    flask_thread = threading.Thread(
        target=run_flask
    )

    flask_thread.daemon = True
    flask_thread.start()

    rclpy.spin(node)

    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()