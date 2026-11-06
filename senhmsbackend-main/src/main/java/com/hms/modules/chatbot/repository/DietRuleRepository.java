package com.hms.modules.chatbot.repository;

import com.hms.modules.chatbot.entity.DietRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface DietRuleRepository extends JpaRepository<DietRule, Long> {

    List<DietRule> findByConditionKeyInAndActiveTrue(Collection<String> conditionKeys);
}
