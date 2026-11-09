package com.aman.amanfi;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Telephony;
import android.telephony.SmsMessage;

import org.json.JSONArray;
import org.json.JSONObject;

import java.security.MessageDigest;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class SmsReceiver extends BroadcastReceiver {

    private static final String PREFS = "amanfi_sms";
    private static final String QUEUE = "pending_transactions";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null ||
            !Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) {
            return;
        }

        SmsMessage[] messages =
            Telephony.Sms.Intents.getMessagesFromIntent(intent);

        if (messages == null) return;

        for (SmsMessage message : messages) {
            if (message == null || message.getMessageBody() == null) continue;

            String body = message.getMessageBody();
            String text = body.toLowerCase(Locale.ROOT);

            if (text.contains("otp") ||
                text.contains("verification code") ||
                text.contains("one time password") ||
                text.contains("የማረጋገጫ ኮድ")) {
                continue;
            }

            // Only recognize CBE-branded transaction messages.
            if (!text.contains("thanks for banking with cbe")) continue;

            String type;
            String category;
            String description;
            String amountPattern;

            if (text.contains("transferred etb")) {
                type = "expense";
                category = "Transfer";
                description = "CBE Transfer";
                amountPattern = "(?i)transferred\\s+ETB\\s+([0-9,]+(?:\\.\\d{1,2})?)";

            } else if (text.contains("received etb")) {
                type = "income";
                category = "Received Transfer";
                description = "CBE Money Received";
                amountPattern = "(?i)received\\s+ETB\\s+([0-9,]+(?:\\.\\d{1,2})?)";

            } else {
                continue;
            }

            try {
                String amountText = findValue(body, amountPattern);
                if (amountText == null) continue;

                double amount = Double.parseDouble(
                    amountText.replace(",", "")
                );

                if (amount <= 0) continue;

                String balanceText = findValue(
                    body,
                    "(?i)current balance is ETB\\s+([0-9,]+(?:\\.\\d{1,2})?)"
                );

                double balance = balanceText == null ? -1 :
                    Double.parseDouble(balanceText.replace(",", ""));

                long timestamp = System.currentTimeMillis();
                String sender = message.getDisplayOriginatingAddress();

                JSONObject transaction = new JSONObject();
                transaction.put(
                    "id",
                    makeId((sender == null ? "" : sender) + "|" + body)
                );
                transaction.put("type", type);
                transaction.put("amount", amount);
                transaction.put("balance", balance);
                transaction.put("category", category);
                transaction.put("method", "CBE");
                transaction.put("desc", description);
                transaction.put("reason", "Not specified");
                transaction.put("date", timestamp);
                transaction.put("source", "sms");

                saveTransaction(context, transaction);

            } catch (Exception ignored) {
                // Never log private SMS contents.
            }
        }
    }

    private String findValue(String body, String regex) {
        Matcher matcher = Pattern.compile(regex).matcher(body);
        return matcher.find() ? matcher.group(1) : null;
    }

    private String makeId(String value) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] bytes = digest.digest(value.getBytes("UTF-8"));

        StringBuilder result = new StringBuilder();
        for (byte b : bytes) {
            result.append(String.format("%02x", b));
        }
        return result.toString();
    }

    private void saveTransaction(Context context, JSONObject transaction)
        throws Exception {

        SharedPreferences prefs =
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        JSONArray stored =
            new JSONArray(prefs.getString(QUEUE, "[]"));

        String newId = transaction.getString("id");

        for (int i = 0; i < stored.length(); i++) {
            if (newId.equals(stored.getJSONObject(i).optString("id"))) {
                return;
            }
        }

        stored.put(transaction);
        prefs.edit().putString(QUEUE, stored.toString()).apply();
    }
}
