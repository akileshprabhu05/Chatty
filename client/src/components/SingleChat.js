import React, { useEffect, useState } from 'react';
import { useChatContext } from '../context/chatContext';
import { IoArrowBackOutline } from 'react-icons/io5';
import { MdExpand } from 'react-icons/md';
import { FaPaperPlane } from 'react-icons/fa';
import { getSender, getSendersFullDetails } from '../utils/helpers';
import { useUserContext } from '../context/userContext';
import bcg2 from '../assets/bcg-2.png';
import { Textarea } from '@chakra-ui/react';
import axios from 'axios';
import io from 'socket.io-client';
import {
  ProfileModal,
  SpinnerLoader,
  UpdateGroupChatModal,
  ScrollableChat,
} from '.';
import {
  Box,
  Image,
  IconButton,
  Flex,
  Text,
  FormControl,
  useToast,
  VStack,
  Avatar,
  HStack,
  Input,
  InputGroup,
  InputRightElement,
  Spinner,
} from '@chakra-ui/react';

let socket;
let selectedChatBackup;
let timeout;

function SingleChat() {
  const { currentUser } = useUserContext();
  const {
    selectedChat,
    notification,
    setSelectedChat,
    setNotification,
    setFetchFlag,
  } = useChatContext();
  const [socketConnected, setSocketConnected] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [typing, setTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const [sending, setSending] = useState(false);
  const toast = useToast();

  const fetchMessages = async () => {
    if (!selectedChat) return;
    try {
      setLoading(true);
      const response = await axios.get(`/api/message/${selectedChat._id}`);
      setMessages(response.data.data);
      setLoading(false);
      socket.emit('join_room', {
        room: selectedChat._id,
        users: selectedChat.users,
      });
    } catch (error) {
      setLoading(false);
      toast({
        position: 'top',
        title: 'Error occurred',
        description: error.response?.data?.message || 'Failed to load messages',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      setSending(true);
      const body = {
        chatId: selectedChat._id,
        content: newMessage,
      };
      setNewMessage('');
      const response = await axios.post('/api/message', body);
      socket.emit('new_message', response.data.data);
      socket.emit('stop_typing', selectedChat._id);
      setMessages((prev) => [...prev, response.data.data]);
    } catch (error) {
      toast({
        position: 'top',
        title: 'Error occurred',
        description: error.response?.data?.message || 'Message failed',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (!socketConnected) return;
    if (!typing) {
      setTyping(true);
      socket.emit('typing', selectedChat._id);
    }

    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(() => {
      setTyping(false);
      socket.emit('stop_typing', selectedChat._id);
    }, 3000);
  };

  const expandMessage = async () => {
    if (!newMessage.trim()) {
      toast({
        title: 'Enter a message first',
        status: 'info',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    try {
      setExpanding(true);
      const response = await axios.post('/generate-reason', {
        shortReason: newMessage,
      },{
        headers: {
          'Content-Type': 'application/json',
        }
      });
      setNewMessage(response.data.fullReason || '');
    } catch (error) {
      toast({
        title: 'Expansion failed',
        description: 'Could not generate detailed message',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setExpanding(false);
    }
  };

  useEffect(() => {
    socket = io(
      process.env.NODE_ENV !== 'production'
        ? 'http://localhost:5000'
        : process.env.REACT_APP_PROJECT_URL
    );
    socket.emit('setup', currentUser);
    socket.on('connected', () => setSocketConnected(true));
    socket.on('user_online_status', (online) => setOnlineStatus(online));
    socket.on('typing', () => setIsTyping(true));
    socket.on('stop_typing', () => setIsTyping(false));
    socket.on('new_message_recieved', (message) => {
      if (!selectedChatBackup || selectedChatBackup._id !== message.chat._id) {
        if (!notification.some((n) => n._id === message._id)) {
          setNotification((prev) => [message, ...prev]);
          setFetchFlag((prev) => !prev);
        }
      } else {
        setMessages((prev) => [...prev, message]);
      }
    });
  }, []);

  useEffect(() => {
    if (selectedChatBackup) {
      socket.emit('leave_room', selectedChatBackup._id);
    }
    fetchMessages();
    selectedChatBackup = selectedChat;
    setTyping(false);
    setIsTyping(false);
  }, [selectedChat]);

  return (
    <Flex flexDirection='column' w='100%'>
      {selectedChat ? (
        <>
          <Flex
            p='4'
            bg='gray.100'
            justifyContent='space-between'
            alignItems='center'
            shadow='sm'
          >
            <IconButton
              icon={<IoArrowBackOutline />}
              display={{ base: 'flex', md: 'none' }}
              onClick={() => setSelectedChat(null)}
            />
            {!selectedChat.isGroupChat ? (
              <>
                <HStack spacing='4'>
                  <Avatar
                    size='md'
                    name={getSender(currentUser, selectedChat.users)}
                    src={
                      getSendersFullDetails(currentUser, selectedChat.users)
                        .avatar.url
                    }
                  />
                  <VStack spacing='0' alignItems='flex-start'>
                    <Text>{getSender(currentUser, selectedChat.users)}</Text>
                    <Text fontSize='sm' color='gray.400'>
                      {onlineStatus
                        ? isTyping
                          ? 'typing...'
                          : 'online'
                        : 'offline'}
                    </Text>
                  </VStack>
                </HStack>
                <ProfileModal
                  user={getSendersFullDetails(currentUser, selectedChat.users)}
                />
              </>
            ) : (
              <>
                <HStack spacing='4'>
                  <Avatar size='md' name={selectedChat.chatName} />
                  <VStack spacing='0' alignItems='flex-start'>
                    <Text>{selectedChat.chatName.toUpperCase()}</Text>
                    {isTyping && (
                      <Text fontSize='sm' color='gray.400'>
                        typing...
                      </Text>
                    )}
                  </VStack>
                </HStack>
                <UpdateGroupChatModal fetchMessages={fetchMessages} />
              </>
            )}
          </Flex>

          <Flex
            w='100%'
            h='100%'
            flexDirection='column'
            justifyContent='flex-end'
            background="linear-gradient(135deg, #ffe6e6 0%, #fcefee 100%)"
            overflowY='hidden'
          >
            {loading ? (
              <SpinnerLoader size='xl' margin='auto' alignSelf='center' />
            ) : (
              <Flex flexDirection='column' overflowY='auto'>
                <ScrollableChat messages={messages} />
              </Flex>
            )}

            <Box py='2' px='4' bg='gray.100'>
              <FormControl isRequired>
                <Flex alignItems="flex-end" gap="2">
                <Textarea
  value={newMessage}
  onChange={(e) => {
    handleTyping(e);
    const textarea = e.target;
    textarea.style.height = "auto"; // Reset to get accurate scrollHeight
    textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`; // Max height ~10 lines (24px x 10)
  }}
  placeholder="Write your message"
  resize="none"
  minH="240px"
  maxH="450px" // 10 lines * approx. 24px line height
  overflowY="auto"
  bg="white"
  borderRadius="lg"
  px="4"
  py="2"
  flex="1"
/>

                  <Flex gap="2" pb="2">
                    <IconButton
                      aria-label='Expand'
                      icon={expanding ? <Spinner size='sm' /> : <MdExpand />}
                      size='sm'
                      bg='gray.200'
                      borderRadius='full'
                      onClick={expandMessage}
                    />
                    <IconButton
                      aria-label='Send'
                      icon={sending ? <Spinner size='sm' /> : <FaPaperPlane />}
                      size='sm'
                      bg='whatsapp.500'
                      color='white'
                      borderRadius='full'
                      onClick={sendMessage}
                    />
                  </Flex>
                </Flex>
              </FormControl>
            </Box>
          </Flex>
        </>
      ) : (
        <Flex
          w='100%'
          h='100%'
          bg='gray.50'
          flexDirection='column'
          justifyContent='space-between'
          alignItems='center'
          overflowY='hidden'
        >
          <VStack
            w='50%'
            m='auto'
            spacing='4'
            justifyContent='center'
            alignItems='center'
          >
            <Image src={bcg2} width='300px' />
            <Text textAlign='center' fontSize='3xl' fontWeight='300'>
              No need to keep phone connected
            </Text>
            <Text textAlign='center' fontWeight='300' color='gray.400'>
              Chatty is centralized and doesn't need phone to be connected.
              Also, it is not End-To-End Encrypted, so chat wisely.
            </Text>
          </VStack>
          <Box w='100%' h='10px' alignSelf='flex-end' bg='whatsapp.400'></Box>
        </Flex>
      )}
    </Flex>
  );
}

export default SingleChat;