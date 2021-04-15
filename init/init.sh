#!/bin/zsh

# First resize the file system to enjoy the full space offered by our EBS volume
PDISK=$(diskutil list physical external | head -n1 | cut -d" " -f1)
APFSCONT=$(diskutil list physical external | grep "Apple_APFS" | tr -s " " | cut -d" " -f8)
yes | sudo diskutil repairDisk $PDISK
sudo diskutil apfs resizeContainer $APFSCONT 0

#brew already installed
#check brew is configured correctly
brew doctor

#install Ruby
brew install chruby
brew install ruby-install
ruby-install ruby-2.7.2

#install Java
brew install --cask corretto

#set shell
echo "source /usr/local/opt/chruby/share/chruby/chruby.sh" >> ~/.zshrc
echo "source /usr/local/opt/chruby/share/chruby/auto.sh" >> ~/.zshrc
echo "chruby ruby-2.7.2" >> ~/.zshrc
echo "export LC_ALL=en_US.UTF-8" >> ~/.zshrc
echo "export LANG=en_US.UTF-8" >> ~/.zshrc
echo "export CI=true" >> ~/.zshrc
source ~/.zshrc
#configure Ruby
ruby -v
echo "gem: --no-document" >> ~/.gemrc
gem update --system
gem install bundler
number_of_cores=$(sysctl -n hw.ncpu)
bundle config --global jobs $((number_of_cores - 1))

#Install xcode
gem install xcode-install
#Needs Apple credentials https://github.com/xcpretty/xcode-install#usage
xcversion install 12.4