from setuptools import setup

package_name = 'telemetry_system'

setup(
    name=package_name,
    version='0.0.0',
    packages=[package_name],
    data_files=[
        ('share/ament_index/resource_index/packages',
         ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='dave',
    maintainer_email='dave@example.com',
    description='ROS2 telemetry system',
    license='MIT',
    tests_require=['pytest'],
    entry_points={
        'console_scripts': [
            'telemetry_publisher = telemetry_system.telemetry_publisher:main',
            'telemetry_listener = telemetry_system.telemetry_listener:main',
            'telemetry_bridge = telemetry_system.telemetry_bridge:main',
        ],
    },
)