import { useState, useRef, useEffect } from 'react';
import { Send, AtSign } from 'lucide-react';
import MentionAutocomplete from './MentionAutocomplete';

interface MessageInputProps {
    onSend: (message: string) => Promise<void>;
    placeholder?: string;
    disabled?: boolean;
    currentUserId?: string; // Should be passed if possible to filter self out
}

export default function MessageInput({ onSend, placeholder = 'Type a message...', disabled, currentUserId = '' }: MessageInputProps) {
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    // Mention states
    const [showMentions, setShowMentions] = useState(false);
    const [mentionQuery, setMentionQuery] = useState('');
    const [cursorPosition, setCursorPosition] = useState(0);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [message]);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const text = e.target.value;
        const cursorPos = e.target.selectionStart;
        setCursorPosition(cursorPos);
        setMessage(text);

        // Mention Detection Logic
        const textBeforeCursor = text.substring(0, cursorPos);
        const lastAt = textBeforeCursor.lastIndexOf('@');

        if (lastAt !== -1) {
            // Check if checking for mention is valid (start of line or preceded by space)
            const isStart = lastAt === 0;
            const isPrecededBySpace = lastAt > 0 && textBeforeCursor[lastAt - 1] === ' ';

            if (isStart || isPrecededBySpace) {
                const query = textBeforeCursor.substring(lastAt + 1);
                // Only trigger if query doesn't contain spaces (simple name search)
                // We allow up to 15 chars for search before giving up to allow typing full user names
                if (!query.includes(' ') && query.length < 20) {
                    setMentionQuery(query);
                    setShowMentions(true);
                    return;
                }
            }
        }

        setShowMentions(false);
    };

    const handleMentionSelect = (user: { full_name: string }) => {
        const textBeforeCursor = message.substring(0, cursorPosition);
        const textAfterCursor = message.substring(cursorPosition);

        const lastAt = textBeforeCursor.lastIndexOf('@');
        const textBeforeAt = textBeforeCursor.substring(0, lastAt);

        // Insert name with a trailing space
        const newText = `${textBeforeAt}@${user.full_name} ${textAfterCursor}`;

        setMessage(newText);
        setShowMentions(false);

        // Refocus and correct selection (optional but nice)
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    };

    const handleSend = async () => {
        if (!message.trim() || sending || disabled) return;

        setSending(true);
        try {
            await onSend(message.trim());
            setMessage('');
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
            setShowMentions(false);
        } catch (err) {
            console.error('Failed to send message:', err);
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="border-t border-white/10 p-4 bg-white/5 relative">
            {/* Mention Suggestions Popup */}
            {showMentions && (
                <MentionAutocomplete
                    searchQuery={mentionQuery}
                    onSelect={handleMentionSelect}
                    currentUserId={currentUserId}
                />
            )}

            <div className="flex gap-2 items-end">
                <div className="flex-1 relative">
                    <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={handleTextChange}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        disabled={disabled || sending}
                        rows={1}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none max-h-32 disabled:opacity-50"
                    />
                    {/* Helper hint for mentions */}
                    {message.length === 0 && (
                        <button
                            className="absolute right-2 bottom-2.5 text-purple-300/30 hover:text-purple-300/70 p-1 rounded-md transition-colors"
                            title="Type @ to mention someone"
                            onClick={() => {
                                setMessage(prev => prev + '@');
                                if (textareaRef.current) textareaRef.current.focus();
                            }}
                        >
                            <AtSign className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <button
                    onClick={handleSend}
                    disabled={!message.trim() || sending || disabled}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white p-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                    <Send className="w-5 h-5" />
                </button>
            </div>
            <p className="text-xs text-purple-300/50 mt-2">
                Press Ctrl+Enter to send • {message.length} characters
            </p>
        </div>
    );
}
