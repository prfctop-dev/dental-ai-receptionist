
const N8N_CHAT_URL = "https://n8n-production-b6af.up.railway.app/webhook/dental-chat";
const N8N_AVAILABILITY_URL = "https://n8n-production-b6af.up.railway.app/webhook/dental-available-slots";
const N8N_BOOKING_URL = "https://n8n-production-b6af.up.railway.app/webhook/dental-book-appointment";

// CHAT ELEMENTS
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const sendButton = document.getElementById("sendButton");
const voiceButton = document.getElementById("voiceButton");
const chatMessages = document.getElementById("chatMessages");
const typingIndicator = document.getElementById("typingIndicator");
const chatStatus = document.getElementById("chatStatus");

// BOOKING ELEMENTS
const bookingForm = document.getElementById("bookingForm");
const appointmentDate = document.getElementById("appointmentDate");
const timeSlots = document.getElementById("timeSlots");
const slotMessage = document.getElementById("slotMessage");
const selectedSlot = document.getElementById("selectedSlot");
const bookingButton = document.getElementById("bookingButton");
const bookingResult = document.getElementById("bookingResult");

let availableSlots = [];
let availabilityRequestNumber = 0;
let isBooking = false;

// --------------------------------------------------
// GENERAL HELPERS
// --------------------------------------------------

function getPakistanDate() {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Karachi",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).format(new Date());
}

function formatPakistanTime(dateString) {
    return new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Karachi",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
    }).format(new Date(dateString));
}

function isSunday(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCDay() === 0;
}

function showBookingMessage(message, type) {
    bookingResult.textContent = message;
    bookingResult.className = "booking-result " + type;
}

// --------------------------------------------------
// CLINIC INFORMATION
// --------------------------------------------------

async function loadClinicInfo() {
    try {
        const response = await fetch("../data/clinic_info.json");

        if (!response.ok) {
            throw new Error("Clinic information could not be loaded.");
        }

        const clinicInfo = await response.json();
        console.log("Clinic information loaded:", clinicInfo);

    } catch (error) {
        console.warn("Clinic information:", error.message);
    }
}

// --------------------------------------------------
// CHAT FUNCTIONS
// --------------------------------------------------

function addMessage(message, sender) {
    const messageElement = document.createElement("div");
    messageElement.className = "message " +
        (sender === "user" ? "user-message" : "bot-message");

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = sender === "user" ? "U" : "✦";

    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = message;

    messageElement.appendChild(avatar);
    messageElement.appendChild(bubble);

    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTyping(show) {
    typingIndicator.hidden = !show;
    chatMessages.scrollTop = chatMessages.scrollHeight;
}



function getLocalAnswer(message) {
    const text = message.toLowerCase().trim();

    // Only handle a greeting when the message is just a greeting.
    if (/^(hi|hello|hey|salam|assalamualaikum)[!. ]*$/i.test(text)) {
        return "Hello! Welcome to Bright Smile Dental Clinic. What can I help you with?";
    }

    // Clinic opening hours
    if (
        /\b(clinic hours|opening hours|working hours|business hours|what time do you open|when do you open|what time do you close|when do you close|are you open today)\b/i.test(text)
    ) {
        return "Bright Smile Dental Clinic is open Monday to Saturday, from 9:00 AM to 6:00 PM. We are closed on Sundays.";
    }

    // Clinic services
    if (
        /\b(what services|which services|what treatments|services do you offer|do you offer.*(cleaning|braces|filling|checkup|extraction)|do you provide.*(cleaning|braces|filling|checkup|extraction))\b/i.test(text)
    ) {
        return "We offer general checkups, teeth cleaning, fillings, braces consultations, and tooth extraction. Is there a particular service you'd like to know about?";
    }

    // Clinic location
    if (
        /\b(where is the clinic|clinic address|clinic location|where are you located|where is your clinic)\b/i.test(text)
    ) {
        return "Bright Smile Dental Clinic is located in Peshawar, Pakistan. Please contact our clinic for exact directions.";
    }

    // Everything else goes to Gemini
    return null;
}





async function getAIReply(message) {

    // Create one session ID for this browser tab
    let dentalChatSessionId = sessionStorage.getItem("dentalChatSessionId");

    if (!dentalChatSessionId) {
        dentalChatSessionId = crypto.randomUUID();
        sessionStorage.setItem(
            "dentalChatSessionId",
            dentalChatSessionId
        );
    }

    const response = await fetch(N8N_CHAT_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            message: message,
            sessionId: dentalChatSessionId
        })
    });

    if (!response.ok) {
        throw new Error("The AI receptionist is currently unavailable.");
    }

    const data = await response.json();

    const reply = data.reply || data.output;

    if (!reply || typeof reply !== "string") {
        throw new Error("The assistant returned an unexpected response.");
    }

    return reply;
}

async function sendMessage(message) {
    if (!message.trim()) return;

    addMessage(message, "user");
    chatInput.value = "";
    sendButton.disabled = true;
    showTyping(true);

    try {
        const localAnswer = getLocalAnswer(message);

        let reply;

        if (localAnswer) {
            reply = localAnswer;
        } else {
            reply = await getAIReply(message);
        }

        addMessage(reply, "bot");
        speakMessage(reply);

    } catch (error) {
        addMessage(
            "Sorry, I'm having trouble responding right now. Please try again shortly.",
            "bot"
        );
        console.error("Chat error:", error);

    } finally {
        showTyping(false);
        sendButton.disabled = false;
        chatInput.focus();
    }
}

chatForm.addEventListener("submit", function (event) {
    event.preventDefault();
    sendMessage(chatInput.value);
});

// QUICK QUESTIONS
document.querySelectorAll(".quick-question").forEach(button => {
    button.addEventListener("click", () => {
        sendMessage(button.textContent);
    });
});

// --------------------------------------------------
// VOICE INPUT AND SPEECH
// --------------------------------------------------

const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = function () {
        voiceButton.classList.add("listening");
        chatStatus.textContent = "Listening...";
    };

    recognition.onend = function () {
        voiceButton.classList.remove("listening");
        chatStatus.textContent = "Typically replies instantly";
    };

    recognition.onresult = function (event) {
        const spokenText = event.results[0][0].transcript;
        chatInput.value = spokenText;
        chatForm.requestSubmit();
    };

    recognition.onerror = function (event) {
        console.error("Voice recognition error:", event.error);
        chatStatus.textContent = "Voice input unavailable";
        voiceButton.classList.remove("listening");
    };

    voiceButton.addEventListener("click", function () {
    try {
        recognition.start();
    } catch (error) {
        console.warn("Voice recognition:", error.message);
    }
});

} else {
    voiceButton.disabled = true;
    voiceButton.title = "Voice recognition is not supported in this browser";
}

function speakMessage(message) {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(message);
    speech.lang = "en-US";
    speech.rate = 1;

    window.speechSynthesis.speak(speech);
}

// --------------------------------------------------
// APPOINTMENT DATE SETUP
// --------------------------------------------------

appointmentDate.min = getPakistanDate();

appointmentDate.addEventListener("change", function () {
    selectedSlot.value = "";
    bookingButton.disabled = true;
    bookingResult.textContent = "";
    bookingResult.className = "booking-result";

    loadAvailableSlots(appointmentDate.value);
});

// --------------------------------------------------
// LOAD AVAILABLE SLOTS FROM N8N
// --------------------------------------------------

async function loadAvailableSlots(date) {
    const requestNumber = ++availabilityRequestNumber;

    availableSlots = [];
    timeSlots.innerHTML = "";
    selectedSlot.value = "";
    bookingButton.disabled = true;

    if (!date) {
        slotMessage.textContent = "Select a date to view available times.";
        return;
    }

    if (date < getPakistanDate()) {
        slotMessage.textContent = "Please select today or a future date.";
        return;
    }

    if (isSunday(date)) {
        slotMessage.textContent = "The clinic is closed on Sundays. Please select another date.";
        return;
    }

    slotMessage.textContent = "Loading available appointment times...";

    try {
        const response = await fetch(
            N8N_AVAILABILITY_URL + "?date=" + encodeURIComponent(date)
        );

        if (!response.ok) {
            throw new Error("Could not retrieve available times.");
        }

        const data = await response.json();

        // Ignore an older request if the customer changed dates.
        if (requestNumber !== availabilityRequestNumber) return;

        if (!Array.isArray(data.slots)) {
            throw new Error("Unexpected availability response.");
        }

        availableSlots = data.slots.filter(slot => {
            return slot.slot_start && new Date(slot.slot_start) > new Date();
        });

        if (availableSlots.length === 0) {
            slotMessage.textContent =
                "No appointment times are available on this date. Please choose another date.";
            return;
        }

        slotMessage.textContent = "Choose one of the available times:";

        availableSlots.forEach(slot => {
            const button = document.createElement("button");

            button.type = "button";
            button.className = "time-slot";
            button.textContent = formatPakistanTime(slot.slot_start);

            button.addEventListener("click", () => {
                document.querySelectorAll(".time-slot").forEach(item => {
                    item.classList.remove("selected");
                });

                button.classList.add("selected");

                selectedSlot.value = slot.slot_start;
                bookingButton.disabled = false;

                showBookingMessage("", "");
            });

            timeSlots.appendChild(button);
        });

    } catch (error) {
        if (requestNumber !== availabilityRequestNumber) return;

        slotMessage.textContent =
            "Unable to load appointment times. Please try again.";

        console.error("Availability error:", error);
    }
}

// --------------------------------------------------
// SUBMIT APPOINTMENT TO N8N
// --------------------------------------------------

bookingForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (isBooking) return;

    const customerName = document.getElementById("customerName").value.trim();
    const phone = document.getElementById("customerPhone").value.trim();
    const email = document.getElementById("customerEmail").value.trim();
    const service = document.getElementById("service").value;
    const slotStart = selectedSlot.value;

    if (!customerName || !phone || !service || !slotStart) {
        showBookingMessage(
            "Please complete all required fields and select an appointment time.",
            "error"
        );
        return;
    }

    if (new Date(slotStart) <= new Date()) {
        showBookingMessage(
            "This appointment time has passed. Please choose another time.",
            "error"
        );
        return;
    }

    const bookingData = {
        customer_name: customerName,
        phone: phone,
        email: email,
        service: service,
        slot_start: slotStart
    };

    isBooking = true;
    bookingButton.disabled = true;
    bookingButton.textContent = "Booking...";
    showBookingMessage("Submitting your appointment...", "");

    try {
        const response = await fetch(N8N_BOOKING_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(bookingData)
        });

        const data = await response.json();

        if (!response.ok || data.success !== true) {
            throw new Error(
                data.message || "This time could not be booked. Please select another time."
            );
        }

        showBookingMessage(
            "Your appointment has been booked successfully! Thank you, " +
            customerName + ".",
            "success"
        );

        bookingForm.reset();
        appointmentDate.min = getPakistanDate();

        availableSlots = [];
        selectedSlot.value = "";
        timeSlots.innerHTML = "";
        slotMessage.textContent = "Select a date to view available times.";

    } catch (error) {
        showBookingMessage(
            error.message || "Booking failed. Please try again.",
            "error"
        );

        console.error("Booking error:", error);

        // Refresh availability in case another customer booked this time.
        if (appointmentDate.value) {
            await loadAvailableSlots(appointmentDate.value);
        }

    } finally {
        isBooking = false;
        bookingButton.disabled = !selectedSlot.value;
        bookingButton.textContent = "Confirm Appointment";
    }
});

// --------------------------------------------------
// INITIALIZE WEBSITE
// --------------------------------------------------

loadClinicInfo();

console.log("Bright Smile Dental Receptionist initialized.");



// ======================================
// APPOINTMENT CANCELLATION
// ======================================

const cancellationForm = document.getElementById("cancellationForm");

if (cancellationForm) {
  cancellationForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const phone = document.getElementById("cancelPhone").value.trim();
    const date = document.getElementById("cancelDate").value;
    const time = document.getElementById("cancelTime").value;

    const button = document.getElementById("cancellationButton");
    const result = document.getElementById("cancellationResult");

    button.disabled = true;
    button.textContent = "Processing...";
    result.textContent = "";

    try {
      // Convert Pakistan local time (UTC+5) into UTC
      const slotStart = new Date(
        `${date}T${time}:00+05:00`
      ).toISOString();

      const response = await fetch(
        "https://n8n-production-b6af.up.railway.app/webhook/dental-cancel-appointment",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            phone: phone,
            slot_start: slotStart
          })
        }
      );

      const data = await response.json();

      result.textContent =
        data.message || "We couldn't process your cancellation.";

      result.style.color = data.success ? "green" : "red";

      if (data.success) {
        cancellationForm.reset();
      }

    } catch (error) {
      result.textContent =
        "Something went wrong. Please try again.";
      result.style.color = "red";
      console.error("Cancellation error:", error);

    } finally {
      button.disabled = false;
      button.textContent = "Cancel Appointment";
    }
  });
}