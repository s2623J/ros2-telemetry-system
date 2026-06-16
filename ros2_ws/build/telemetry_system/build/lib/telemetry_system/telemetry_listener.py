import rclpy

from rclpy.node import Node
from std_msgs.msg import String


class TelemetryListener(Node):

    def __init__(self):
        super().__init__('telemetry_listener')

        self.subscription = self.create_subscription(
            String,
            'telemetry',
            self.listener_callback,
            10
        )

        self.get_logger().info('Telemetry Listener Started')

    def listener_callback(self, msg):
        self.get_logger().info(
            f'Received Telemetry -> {msg.data}'
        )


def main(args=None):
    rclpy.init(args=args)

    node = TelemetryListener()

    rclpy.spin(node)

    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()