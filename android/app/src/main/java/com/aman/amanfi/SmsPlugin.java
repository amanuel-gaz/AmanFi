package com.aman.amanfi;

import android.content.SharedPreferences;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;

import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "SmsPlugin")
public class SmsPlugin extends Plugin {

    private static final String PREFS = "amanfi_sms";
    private static final String QUEUE = "pending_transactions";

    @PluginMethod
    public void getPendingTransactions(PluginCall call) {
        SharedPreferences prefs =
            getContext().getSharedPreferences(PREFS, 0);

        String saved = prefs.getString(QUEUE, "[]");

        try {
            JSONArray stored = new JSONArray(saved);
            JSArray transactions = new JSArray();

            for (int i = 0; i < stored.length(); i++) {
                transactions.put(stored.getJSONObject(i));
            }

            JSObject result = new JSObject();
            result.put("transactions", transactions);
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Could not read saved transactions.");
        }
    }

    @PluginMethod
    public void acknowledgeTransactions(PluginCall call) {
        JSArray ids = call.getArray("ids");

        if (ids == null) {
            call.reject("Transaction IDs are required.");
            return;
        }

        SharedPreferences prefs =
            getContext().getSharedPreferences(PREFS, 0);

        try {
            JSONArray stored =
                new JSONArray(prefs.getString(QUEUE, "[]"));

            JSONArray remaining = new JSONArray();

            for (int i = 0; i < stored.length(); i++) {
                JSONObject item = stored.getJSONObject(i);
                String id = item.optString("id", "");
                boolean acknowledged = false;

                for (int j = 0; j < ids.length(); j++) {
                    if (id.equals(ids.getString(j))) {
                        acknowledged = true;
                        break;
                    }
                }

                if (!acknowledged) {
                    remaining.put(item);
                }
            }

            prefs.edit().putString(QUEUE, remaining.toString()).apply();

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Could not acknowledge transactions.");
        }
    }
}
