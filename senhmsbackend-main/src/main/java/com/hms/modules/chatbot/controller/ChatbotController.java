package com.hms.modules.chatbot.controller;

import com.hms.common.ApiResponse;
import com.hms.modules.chatbot.dto.DataAnswer;
import com.hms.modules.chatbot.dto.DataQueryRequest;
import com.hms.modules.chatbot.dto.DietPlanRequest;
import com.hms.modules.chatbot.dto.DietPlanResponse;
import com.hms.modules.chatbot.dto.StaticQuestion;
import com.hms.modules.chatbot.service.ChatbotDataService;
import com.hms.modules.chatbot.service.DietPlanService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/chatbot")
@RequiredArgsConstructor
public class ChatbotController {

    private final ChatbotDataService dataService;
    private final DietPlanService dietService;

    /** GET /api/chatbot/questions — the static questions this user may ask. */
    @GetMapping("/questions")
    public ResponseEntity<ApiResponse<List<StaticQuestion>>> questions(Authentication auth) {
        return ResponseEntity.ok(ApiResponse.ok(dataService.questionsFor(roles(auth))));
    }

    /** POST /api/chatbot/data-query — answer a hospital-data question. */
    @PostMapping("/data-query")
    public ResponseEntity<ApiResponse<DataAnswer>> dataQuery(@Valid @RequestBody DataQueryRequest req, Authentication auth) {
        return ResponseEntity.ok(ApiResponse.ok(dataService.ask(req.getQuestion(), roles(auth))));
    }

    /** POST /api/chatbot/diet-plan — AI diet plan inside clinical safety rules. */
    @PostMapping("/diet-plan")
    public ResponseEntity<ApiResponse<DietPlanResponse>> dietPlan(@Valid @RequestBody DietPlanRequest req) {
        return ResponseEntity.ok(ApiResponse.ok(dietService.generate(req)));
    }

    private static Set<String> roles(Authentication auth) {
        return auth.getAuthorities().stream().map(GrantedAuthority::getAuthority)
                .map(a -> a.startsWith("ROLE_") ? a.substring(5) : a).collect(Collectors.toSet());
    }
}
