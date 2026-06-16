import json
import random

import rclpy
from rclpy.node import Node
from std_msgs.msg import String


class TelemetryPublisher(Node):

    def __init__(self):
        super().__init__('telemetry_publisher')

        self.publisher_ = self.create_publisher(
            String,
            'telemetry',
            10
        )

        self.timer = self.create_timer(
            1.0,
            self.publish_telemetry
        )

        self.get_logger().info('Telemetry Publisher Started')

    def publish_telemetry(self):
        telemetry_data = {
            "battery": random.randint(70, 100),
            "cpu_temp": random.randint(40, 80),
            "uptime": random.randint(100, 10000)
        }

        msg = String()
        msg.data = json.dumps(telemetry_data)

        self.publisher_.publish(msg)

        self.get_logger().info(
            f'Publishing telemetry: {telemetry_data}'
        )


def main(args=None):
    rclpy.init(args=args)

    node = TelemetryPublisher()

    rclpy.spin(node)

    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()