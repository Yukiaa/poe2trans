package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
)

type Skill struct {
	ID            string   `json:"id"`
	NameSC        string   `json:"name_sc"`
	NameTC        string   `json:"name_tc"`
	NameEN        string   `json:"name_en"`
	Type          string   `json:"type"`
	DescriptionSC string   `json:"description_sc"`
	DescriptionTC string   `json:"description_tc"`
	DescriptionEN string   `json:"description_en"`
	Tags          []string `json:"tags"`
	Icon          string   `json:"icon"`
}

var (
	skills   []Skill
	skillsMu sync.RWMutex
)

func loadSkills(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var s []Skill
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	skillsMu.Lock()
	skills = s
	skillsMu.Unlock()
	log.Printf("Loaded %d skills", len(s))
	return nil
}

func searchHandler(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("q")))
	limit := 10
	if l := r.URL.Query().Get("limit"); l != "" {
		if n := parseInt(l); n > 0 && n <= 50 {
			limit = n
		}
	}

	skillsMu.RLock()
	defer skillsMu.RUnlock()

	type hit struct {
		Skill
		MatchIn string `json:"match_in"`
	}
	var results []hit
	if q == "" {
		for i := 0; i < len(skills) && i < limit; i++ {
			results = append(results, hit{Skill: skills[i], MatchIn: "default"})
		}
	} else {
		for _, s := range skills {
			matchIn := ""
			if strings.Contains(strings.ToLower(s.NameSC), q) ||
				strings.Contains(strings.ToLower(s.NameTC), q) ||
				strings.Contains(strings.ToLower(s.NameEN), q) ||
				strings.Contains(strings.ToLower(s.DescriptionSC), q) {
				matchIn = "name"
			}
			if matchIn == "" {
				for _, t := range s.Tags {
					if strings.Contains(strings.ToLower(t), q) {
						matchIn = "tag"
						break
					}
				}
			}
			if matchIn != "" {
				results = append(results, hit{Skill: s, MatchIn: matchIn})
				if len(results) >= limit {
					break
				}
			}
		}
	}

	if results == nil {
		results = []hit{}
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(results)
}

func skillByIDHandler(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/skill/")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}
	skillsMu.RLock()
	defer skillsMu.RUnlock()
	for _, s := range skills {
		if s.ID == id {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			json.NewEncoder(w).Encode(s)
			return
		}
	}
	http.Error(w, "not found", http.StatusNotFound)
}

func parseInt(s string) int {
	n := 0
	for _, c := range s {
		if c >= '0' && c <= '9' {
			n = n*10 + int(c-'0')
		}
	}
	return n
}

func main() {
	dataPath := filepath.Join("data", "skills.json")
	if err := loadSkills(dataPath); err != nil {
		log.Fatalf("Failed to load skills: %v", err)
	}

	http.HandleFunc("/api/search", searchHandler)
	http.HandleFunc("/api/skill/", skillByIDHandler)

	fs := http.FileServer(http.Dir("static"))
	http.Handle("/", fs)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	addr := ":" + port
	log.Printf("Server running at http://localhost%s", addr)
	log.Fatal(http.ListenAndServe(addr, nil))
}
