import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';

import { EksProps } from './eks-cluster';
import { IAMProps} from './s3-stack';
import { SubnetType } from '@aws-cdk/aws-ec2';
import * as iam from "@aws-cdk/aws-iam";

export class EC2Stack extends cdk.Stack {

    constructor(scope: cdk.Construct, id: string, props: EksProps) {
        super(scope, id, props);

        const mySecurityGroup = new ec2.SecurityGroup(this, 'CDKJenkinsSecurityGroup', {
            vpc: props.cluster.vpc,
            description: 'Allow outbound communication',
            allowAllOutbound: true
        });

        const instance = new ec2.Instance(this, 'CDKJenkinsWorker', {
            instanceType: new ec2.InstanceType("mac1.metal"),
            machineImage: ec2.MachineImage.genericLinux({
                'us-west-2': 'ami-0241089f401e28a27',
                'us-east-1': 'ami-0e813c305f63cecbd',
                'us-east-2': 'ami-00692c69a6f9c6ea1',
                'eu-west-1': 'ami-0174e969a3db591be',
                'ap-southeast-1': 'ami-03d18538f88718c75'
            }),
            securityGroup: mySecurityGroup,
            role: props.myIAMRole,
            vpc: props.cluster.vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PUBLIC
            },
            keyName: "mac-key",
            blockDevices: [
                {
                    deviceName: "/dev/sda1",
                    volume: ec2.BlockDeviceVolume.ebs(150)
                },
            ]
        });

        const JENKINS_ALB = process.env.JENKINS_ALB;
        const JENKINS_SECRET = process.env.JENKINS_SECRET;

        const userData = `
#!/bin/bash
JENKINS_ALB="${JENKINS_ALB}"
WORKER_NAME="macos-worker"
JENKINS_SECRET="${JENKINS_SECRET}"

# Download file
curl -o /Users/ec2-user/remoting.jar http://$JENKINS_ALB/jnlpJars/slave.jar

# Create startup script
cat <<EOF > /Users/ec2-user/startup.sh
sudo su - ec2-user -c 'java -jar /Users/ec2-user/remoting.jar -jnlpUrl http://$JENKINS_ALB/computer/$WORKER_NAME/jenkins-agent.jnlp -secret $JENKINS_SECRET -workDir "/Users/ec2-user"' 

EOF

# Create Launch Daemon
cat <<EOF > /Users/ec2-user/com.amazon.aws.jenkins.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
    <dict>
        <key>EnvironmentVariables</key>
        <dict>
            <key>PATH</key>
            <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/sbin</string>
        </dict>
        <key>KeepAlive</key>
        <dict>
            <key>SuccessfulExit</key>
            <false/>
        </dict>
        <key>Label</key>
        <string>com.amazon.aws.jenkins</string>
        <key>ProgramArguments</key>
        <array>
            <string>sh</string>
            <string>/Users/ec2-user/startup.sh</string>
        </array>
        <key>RunAtLoad</key>
        <true/>
        <key>SessionCreate</key>
        <true />
        <key>StandardOutPath</key>
        <string>/Users/ec2-user/remoting.log</string>
        <key>StandardErrorPath</key>
        <string>/Users/ec2-user/remoting-err.log</string>
    </dict>
</plist>

EOF

echo "Copying Daemon"
cp /Users/ec2-user/com.amazon.aws.jenkins.plist /Library/LaunchDaemons/com.amazon.aws.jenkins.plist

# Register Launch Daemon
echo "Register Launch Daemon"
launchctl load -w /Library/LaunchDaemons/com.amazon.aws.jenkins.plist

`;
        //Install JDK
        instance.addUserData(userData);

        const cfnInstance = instance.node.defaultChild as ec2.CfnInstance;
        cfnInstance.addPropertyOverride('Tenancy', 'host');

        new cdk.CfnOutput(this, 'MacOS Worker IP', { value: instance.instancePublicIp });
    }
}
