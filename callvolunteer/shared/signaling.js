export function createSignalingChannel(supabaseClient, sessionId, onMessage) {
    if (!supabaseClient) {
      throw new Error("Thiếu supabaseClient.");
    }
  
    const channelName = `callvolunteer:${sessionId}`;
    const channel = supabaseClient.channel(channelName, {
      config: {
        broadcast: { self: false }
      }
    });
  
    channel.on("broadcast", { event: "signal" }, (payload) => {
      if (typeof onMessage === "function") {
        onMessage(payload.payload);
      }
    });
  
    return {
      channel,
  
      subscribe() {
        return new Promise((resolve, reject) => {
          channel.subscribe((status, err) => {
            if (err) {
              reject(err);
              return;
            }
  
            if (status === "SUBSCRIBED") {
              resolve();
            }
          });
        });
      },
  
      async send(message) {
        const result = await channel.send({
          type: "broadcast",
          event: "signal",
          payload: message
        });
  
        if (result !== "ok") {
          throw new Error("Không gửi được tín hiệu signaling.");
        }
      },
  
      async unsubscribe() {
        await supabaseClient.removeChannel(channel);
      }
    };
  }