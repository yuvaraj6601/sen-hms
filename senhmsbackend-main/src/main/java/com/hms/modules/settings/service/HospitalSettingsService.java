package com.hms.modules.settings.service;

import com.hms.modules.settings.dto.HospitalSettingsRequest;
import com.hms.modules.settings.dto.HospitalSettingsResponse;
import com.hms.modules.settings.entity.HospitalSettings;
import com.hms.modules.settings.repository.HospitalSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional
public class HospitalSettingsService {

    private final HospitalSettingsRepository repo;

    @Transactional(readOnly = true)
    public HospitalSettingsResponse get() {
        return repo.findFirst()
                .map(this::toResponse)
                .orElseGet(() -> {
                    // Return defaults if no settings exist yet
                    HospitalSettingsResponse r = new HospitalSettingsResponse();
                    r.setHospitalName("SEN Hospital");
                    return r;
                });
    }

    public HospitalSettingsResponse save(HospitalSettingsRequest req) {
        HospitalSettings settings = repo.findFirst().orElse(new HospitalSettings());

        settings.setHospitalName(req.getHospitalName());
        settings.setHospitalNameSecondary(req.getHospitalNameSecondary());
        settings.setAddress(req.getAddress());
        settings.setCity(req.getCity());
        settings.setState(req.getState());
        settings.setPinCode(req.getPinCode());
        settings.setPhone(req.getPhone());
        settings.setAlternatePhone(req.getAlternatePhone());
        settings.setEmail(req.getEmail());
        settings.setWebsite(req.getWebsite());
        settings.setGstNo(req.getGstNo());
        settings.setRegNo(req.getRegNo());
        settings.setDlNo(req.getDlNo());
        settings.setBillSettingsJson(req.getBillSettingsJson());
        settings.setDocumentSettingsJson(req.getDocumentSettingsJson());
        settings.setWatermarkSettingsJson(req.getWatermarkSettingsJson());

        return toResponse(repo.save(settings));
    }

    private HospitalSettingsResponse toResponse(HospitalSettings s) {
        HospitalSettingsResponse r = new HospitalSettingsResponse();
        r.setId(s.getId());
        r.setHospitalName(s.getHospitalName());
        r.setHospitalNameSecondary(s.getHospitalNameSecondary());
        r.setAddress(s.getAddress());
        r.setCity(s.getCity());
        r.setState(s.getState());
        r.setPinCode(s.getPinCode());
        r.setPhone(s.getPhone());
        r.setAlternatePhone(s.getAlternatePhone());
        r.setEmail(s.getEmail());
        r.setWebsite(s.getWebsite());
        r.setGstNo(s.getGstNo());
        r.setRegNo(s.getRegNo());
        r.setDlNo(s.getDlNo());
        r.setBillSettingsJson(s.getBillSettingsJson());
        r.setDocumentSettingsJson(s.getDocumentSettingsJson());
        r.setWatermarkSettingsJson(s.getWatermarkSettingsJson());
        r.setUpdatedBy(s.getUpdatedBy());
        r.setUpdatedAt(s.getUpdatedAt());
        return r;
    }
}
