package com.hms.modules.chatbot.service;

import com.hms.modules.chatbot.dto.DataAnswer;
import com.hms.modules.chatbot.enums.DataTool;

/** Runs one catalogue tool against the database and returns its table / chart (answer text left empty). */
public interface DataToolExecutor {
    DataAnswer execute(DataTool tool);
}
